// Server functions for Social Intelligence Engine (Fase 1 — CRUD perfis).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveTargetCandidate, userClientFromToken, userIdFromToken } from "./whatsapp.server";
import { assertSocialRuntimeEnv, logSocialError, throwSocialDebugError } from "./social.server";

const TokenInput = z.object({
  access_token: z.string().min(10),
  candidate_id: z.string().uuid().optional().nullable(),
});

const UsernameSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[A-Za-z0-9_.]+$/, "Username Instagram inválido");

const ProfileTypeSchema = z.enum(["own_profile", "competitor", "portal", "influencer"]);

export const listSocialProfiles = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const candidateId = await resolveTargetCandidate(sb, callerId, data.candidate_id);
    const { data: rows, error } = await sb
      .from("social_profiles")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { profiles: rows ?? [] };
  });

export const createSocialProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({
      username: UsernameSchema,
      profile_type: ProfileTypeSchema,
      display_name: z.string().max(120).optional().nullable(),
      check_interval_minutes: z.number().int().min(30).max(10080).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const username = data.username.replace(/^@/, "").toLowerCase();
    const payload = {
      username,
      profile_type: data.profile_type,
      display_name: data.display_name ?? null,
      check_interval_minutes:
        data.check_interval_minutes ??
        (data.profile_type === "own_profile" ? 180 : 360),
      requested_candidate_id: data.candidate_id ?? null,
    };

    try {
      const env = assertSocialRuntimeEnv("createSocialProfile.env", ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
      const callerId = await userIdFromToken(data.access_token);
      let candidateId = callerId;

      if (data.candidate_id && data.candidate_id !== callerId) {
        const { data: adminRole, error: adminRoleErr } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", callerId)
          .eq("role", "admin")
          .maybeSingle();

        if (adminRoleErr) throw adminRoleErr;
        if (!adminRole) throw new Error("Forbidden");
        candidateId = data.candidate_id;
      }

      const { data: row, error } = await supabaseAdmin
        .from("social_profiles")
        .insert({
          candidate_id: candidateId,
          username,
          profile_type: data.profile_type,
          display_name: data.display_name ?? null,
          check_interval_minutes:
            data.check_interval_minutes ??
            (data.profile_type === "own_profile" ? 180 : 360),
        })
        .select()
        .single();
      if (error) {
        if (/duplicate key/i.test(error.message)) {
          throw new Error("Perfil já cadastrado");
        }
        throw error;
      }

      try {
        const { error: insErr } = await supabaseAdmin.from("social_jobs").insert({
          candidate_id: candidateId,
          profile_id: row.id,
          job_type: "crawl_profile",
          priority: 25,
          scheduled_at: new Date().toISOString(),
        });
        if (insErr) throw insErr;
      } catch (error) {
        logSocialError("createSocialProfile.enqueue_social_job", error, {
          payload,
          candidate_id: candidateId,
          username,
          profile_id: row.id,
          env,
        });
      }

      return { profile: row };
    } catch (error) {
      throwSocialDebugError("createSocialProfile", error, {
        payload,
        candidate_id: data.candidate_id ?? null,
        username,
      });
    }
  });

export const toggleSocialProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({
      profile_id: z.string().uuid(),
      is_active: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const { error } = await sb
      .from("social_profiles")
      .update({ is_active: data.is_active })
      .eq("id", data.profile_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSocialProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({ profile_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const { error } = await sb
      .from("social_profiles")
      .delete()
      .eq("id", data.profile_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSocialAlerts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const candidateId = await resolveTargetCandidate(sb, callerId, data.candidate_id);
    const { data: rows, error } = await sb
      .from("social_alerts")
      .select("*")
      .eq("candidate_id", candidateId)
      .eq("is_dismissed", false)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { alerts: rows ?? [] };
  });

export const getSocialOpsStats = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const sb = await userClientFromToken(data.access_token);
      const { data: stats, error } = await sb.rpc("social_dashboard_stats");
      if (error) throw error;
      return { stats };
    } catch (error) {
      throwSocialDebugError("getSocialOpsStats.social_dashboard_stats", error);
    }
  });

export const forceEnqueueSocial = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const sb = await userClientFromToken(data.access_token);
      const callerId = await userIdFromToken(data.access_token);
      const candidateId = await resolveTargetCandidate(sb, callerId, data.candidate_id);

      const { data: profiles, error: pErr } = await sb
        .from("social_profiles")
        .select("id")
        .eq("candidate_id", candidateId)
        .eq("is_active", true);
      if (pErr) throw pErr;
      if (!profiles || profiles.length === 0) {
        return { enqueued: 0, message: "Nenhum perfil ativo." };
      }

      let enqueued = 0;
      for (const p of profiles) {
        const { data: existing, error: existingErr } = await sb
          .from("social_jobs")
          .select("id")
          .eq("profile_id", p.id)
          .in("status", ["pending", "running"])
          .limit(1)
          .maybeSingle();
        if (existingErr) throw existingErr;
        if (existing) continue;
        const { error: insErr } = await sb.from("social_jobs").insert({
          candidate_id: candidateId,
          profile_id: p.id,
          job_type: "crawl_profile",
          priority: 50,
          scheduled_at: new Date().toISOString(),
        });
        if (insErr) throw insErr;
        enqueued++;
      }

      const { error: resetErr } = await sb
        .from("social_profiles")
        .update({ last_checked_at: null })
        .eq("candidate_id", candidateId)
        .eq("is_active", true);
      if (resetErr) throw resetErr;

      return { enqueued, message: `${enqueued} job(s) criado(s).` };
    } catch (error) {
      throwSocialDebugError("forceEnqueueSocial", error, {
        candidate_id: data.candidate_id ?? null,
      });
    }
  });

