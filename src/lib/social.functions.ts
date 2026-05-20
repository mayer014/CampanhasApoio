// Server functions for Social Intelligence Engine (Fase 1 — CRUD perfis).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveTargetCandidate, userClientFromToken, userIdFromToken } from "./whatsapp.server";

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
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const candidateId = await resolveTargetCandidate(sb, callerId, data.candidate_id);

    const username = data.username.replace(/^@/, "").toLowerCase();

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
      if (/duplicate key/i.test(error.message)) {
        throw new Error("Perfil já cadastrado");
      }
      throw new Error(error.message);
    }
    return { profile: row };
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
    const sb = await userClientFromToken(data.access_token);
    const { data: stats, error } = await sb.rpc("social_dashboard_stats");
    if (error) throw new Error(error.message);
    return { stats };
  });

