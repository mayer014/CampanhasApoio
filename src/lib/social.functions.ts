// Server functions for Social Intelligence Engine (Fase 1 — CRUD perfis).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveTargetCandidate, userClientFromToken, userIdFromToken } from "./whatsapp.server";
import { assertSocialRuntimeEnv, logSocialError, socialDebugPayload, socialEnvStatus } from "./social.server";

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Erro interno";
}

function isDuplicateProfileError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const details = "details" in error && typeof error.details === "string" ? error.details : "";
  const code = "code" in error && typeof error.code === "string" ? error.code : "";

  return (
    code === "23505" ||
    /duplicate key/i.test(message) ||
    /duplicate key/i.test(details) ||
    /social_profiles/i.test(message) ||
    /social_profiles/i.test(details)
  );
}

export const listSocialProfiles = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const sb = await userClientFromToken(data.access_token);
      const callerId = await userIdFromToken(data.access_token);
      const candidateId = await resolveTargetCandidate(sb, callerId, data.candidate_id);
      const { data: rows, error } = await sb
        .from("social_profiles")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return { ok: true, profiles: rows ?? [] };
    } catch (error) {
      const details: any = socialDebugPayload("listSocialProfiles", error, {
        candidate_id: data.candidate_id ?? null,
      });
      logSocialError("listSocialProfiles", error, {
        candidate_id: data.candidate_id ?? null,
      });
      return { ok: false, message: details.error, details, profiles: [] };
    }
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
      const env = assertSocialRuntimeEnv("createSocialProfile.env", ["SUPABASE_URL"]);
      const sb = await userClientFromToken(data.access_token);
      const callerId = await userIdFromToken(data.access_token);
      const candidateId = await resolveTargetCandidate(sb, callerId, data.candidate_id);

      const { data: existingProfile, error: existingProfileError } = await sb
        .from("social_profiles")
        .select("id")
        .eq("candidate_id", candidateId)
        .eq("username", username)
        .maybeSingle();

      if (existingProfileError) {
        throw new Error(getErrorMessage(existingProfileError));
      }

      if (existingProfile) {
        return {
          ok: false,
          stage: "createSocialProfile",
          message: "Perfil já cadastrado",
          details: {
            payload,
            candidate_id: candidateId,
            username,
            existing_profile_id: existingProfile.id,
          },
          profile: null,
        };
      }

      const { data: row, error } = await sb
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
        if (isDuplicateProfileError(error)) {
          throw new Error("Perfil já cadastrado");
        }
        throw new Error(getErrorMessage(error));
      }

      const runtimeEnv = socialEnvStatus();
      if (runtimeEnv.hasSupabaseServiceRoleKey) {
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
      } else {
        logSocialError("createSocialProfile.enqueue_social_job.skipped_missing_service_role", new Error("SUPABASE_SERVICE_ROLE_KEY unavailable in runtime"), {
          payload,
          candidate_id: candidateId,
          username,
          profile_id: row.id,
          env,
          runtime_env: runtimeEnv,
        });
      }

      return { ok: true, profile: row };
    } catch (error) {
      const message = isDuplicateProfileError(error) ? "Perfil já cadastrado" : getErrorMessage(error);
      const details: any = socialDebugPayload("createSocialProfile", error, {
        payload,
        candidate_id: data.candidate_id ?? null,
        username,
      });
      logSocialError("createSocialProfile", error, {
        payload,
        candidate_id: data.candidate_id ?? null,
        username,
      });
      return {
        ok: false,
        stage: "createSocialProfile",
        message,
        details,
        profile: null,
      };
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
    try {
      const sb = await userClientFromToken(data.access_token);
      const { error } = await sb
        .from("social_profiles")
        .update({ is_active: data.is_active })
        .eq("id", data.profile_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (error) {
      const details: any = socialDebugPayload("toggleSocialProfile", error, {
        profile_id: data.profile_id,
        is_active: data.is_active,
      });
      logSocialError("toggleSocialProfile", error, {
        profile_id: data.profile_id,
        is_active: data.is_active,
      });
      return { ok: false, message: details.error, details };
    }
  });

export const deleteSocialProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({ profile_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const sb = await userClientFromToken(data.access_token);
      const { error } = await sb
        .from("social_profiles")
        .delete()
        .eq("id", data.profile_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (error) {
      const details: any = socialDebugPayload("deleteSocialProfile", error, {
        profile_id: data.profile_id,
      });
      logSocialError("deleteSocialProfile", error, {
        profile_id: data.profile_id,
      });
      return { ok: false, message: details.error, details };
    }
  });

export const listSocialAlerts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    try {
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
      return { ok: true, alerts: rows ?? [] };
    } catch (error) {
      const details: any = socialDebugPayload("listSocialAlerts", error, {
        candidate_id: data.candidate_id ?? null,
      });
      logSocialError("listSocialAlerts", error, {
        candidate_id: data.candidate_id ?? null,
      });
      return { ok: false, message: details.error, details, alerts: [] };
    }
  });

export const getSocialOpsStats = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const sb = await userClientFromToken(data.access_token);
      const { data: stats, error } = await sb.rpc("social_dashboard_stats");
      if (error) throw error;
      return { ok: true, stats };
    } catch (error) {
      const details: any = socialDebugPayload("getSocialOpsStats.social_dashboard_stats", error);
      logSocialError("getSocialOpsStats.social_dashboard_stats", error);
      return {
        ok: false,
        stage: "getSocialOpsStats.social_dashboard_stats",
        message: details.error,
        details,
        stats: null,
      };
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
        return { ok: true, enqueued: 0, message: "Nenhum perfil ativo." };
      }

      const runtimeEnv = socialEnvStatus();
      if (!runtimeEnv.hasSupabaseServiceRoleKey) {
        logSocialError(
          "forceEnqueueSocial.missing_service_role",
          new Error("SUPABASE_SERVICE_ROLE_KEY unavailable in runtime"),
          {
            candidate_id: candidateId,
            requested_candidate_id: data.candidate_id ?? null,
            profiles_count: profiles.length,
            runtime_env: runtimeEnv,
          },
        );
        return {
          ok: false,
          enqueued: 0,
          message: "Fila social indisponível no servidor. Verifique SUPABASE_SERVICE_ROLE_KEY no runtime.",
          details: {
            candidate_id: candidateId,
            requested_candidate_id: data.candidate_id ?? null,
            profiles_count: profiles.length,
            runtime_env: runtimeEnv,
          },
        };
      }

      let enqueued = 0;
      for (const p of profiles) {
        const { data: existing, error: existingErr } = await supabaseAdmin
          .from("social_jobs")
          .select("id")
          .eq("profile_id", p.id)
          .in("status", ["pending", "running"])
          .limit(1)
          .maybeSingle();
        if (existingErr) throw existingErr;
        if (existing) continue;
        const { error: insErr } = await supabaseAdmin.from("social_jobs").insert({
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

      return { ok: true, enqueued, message: `${enqueued} job(s) criado(s).` };
    } catch (error) {
      const details: any = socialDebugPayload("forceEnqueueSocial", error, {
        candidate_id: data.candidate_id ?? null,
      });
      logSocialError("forceEnqueueSocial", error, {
        candidate_id: data.candidate_id ?? null,
      });
      return {
        ok: false,
        stage: "forceEnqueueSocial",
        message: details.error,
        details,
        enqueued: 0,
      };
    }
  });

