// Server functions for Social Intelligence Engine.
// Todas usam requireSupabaseAuth para herdar token + supabase client autenticado
// (sem import dinâmico e sem criar client a cada request).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  enqueueInitialSocialCollection,
  enqueueMissingSocialCollections,
  getSocialErrorMessage,
  isDuplicateSocialProfileError,
  resolveSocialCandidateId,
  safeSocialRun,
} from "./social.functions.server";
import { socialEnvStatus } from "./social.server";

const UsernameSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[A-Za-z0-9_.]+$/, "Username Instagram inválido");

const ProfileTypeSchema = z.enum(["own_profile", "competitor", "portal", "influencer"]);

const CandidateInput = z.object({
  candidate_id: z.string().uuid().optional().nullable(),
});

// ---------------------------------------------------------------------------
// Diagnóstico — usado pela UI para diferenciar erro de env, banco ou sessão.
// ---------------------------------------------------------------------------
export const getSocialDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const env = socialEnvStatus();
    const checks: Record<string, { ok: boolean; message?: string }> = {};

    try {
      const { error } = await supabase
        .from("social_profiles")
        .select("id", { count: "exact", head: true })
        .eq("candidate_id", userId);
      checks.profiles_table = { ok: !error, message: error?.message };
    } catch (e) {
      checks.profiles_table = { ok: false, message: getSocialErrorMessage(e) };
    }

    try {
      const { error } = await supabase.rpc("social_dashboard_stats");
      checks.dashboard_rpc = { ok: !error, message: error?.message };
    } catch (e) {
      checks.dashboard_rpc = { ok: false, message: getSocialErrorMessage(e) };
    }

    return {
      ok: true,
      env,
      checks,
      user_id: userId,
    };
  });

// ---------------------------------------------------------------------------
// Perfis
// ---------------------------------------------------------------------------
export const listSocialProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CandidateInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    return safeSocialRun("listSocialProfiles", { candidate_id: data.candidate_id ?? null }, async () => {
      const candidateId = await resolveSocialCandidateId(supabase, userId, data.candidate_id ?? null);
      const { data: rows, error } = await supabase
        .from("social_profiles")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return { ok: true as const, profiles: rows ?? [] };
    });
  });

export const createSocialProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    CandidateInput.extend({
      username: UsernameSchema,
      profile_type: ProfileTypeSchema,
      display_name: z.string().max(120).optional().nullable(),
      check_interval_minutes: z.number().int().min(30).max(10080).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const username = data.username.replace(/^@/, "").toLowerCase();

    return safeSocialRun("createSocialProfile", { username }, async () => {
      const candidateId = await resolveSocialCandidateId(supabase, userId, data.candidate_id ?? null);

      const { data: existing, error: existingErr } = await supabase
        .from("social_profiles")
        .select("id")
        .eq("candidate_id", candidateId)
        .eq("username", username)
        .maybeSingle();
      if (existingErr) throw new Error(existingErr.message);
      if (existing) {
        return {
          ok: false as const,
          stage: "createSocialProfile",
          message: "Perfil já cadastrado",
          details: { existing_profile_id: existing.id },
          profile: null,
        };
      }

      const { data: row, error } = await supabase
        .from("social_profiles")
        .insert({
          candidate_id: candidateId,
          username,
          profile_type: data.profile_type,
          display_name: data.display_name ?? null,
          check_interval_minutes:
            data.check_interval_minutes ?? (data.profile_type === "own_profile" ? 180 : 360),
        })
        .select()
        .single();
      if (error) {
        if (isDuplicateSocialProfileError(error)) throw new Error("Perfil já cadastrado");
        throw new Error(error.message);
      }

      await enqueueInitialSocialCollection(candidateId, row.id);

      return { ok: true as const, profile: row };
    });
  });

export const toggleSocialProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ profile_id: z.string().uuid(), is_active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    return safeSocialRun("toggleSocialProfile", { profile_id: data.profile_id }, async () => {
      const { error } = await supabase
        .from("social_profiles")
        .update({ is_active: data.is_active })
        .eq("id", data.profile_id);
      if (error) throw new Error(error.message);
      return { ok: true as const };
    });
  });

export const deleteSocialProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ profile_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    return safeSocialRun("deleteSocialProfile", { profile_id: data.profile_id }, async () => {
      const { error } = await supabase
        .from("social_profiles")
        .delete()
        .eq("id", data.profile_id);
      if (error) throw new Error(error.message);
      return { ok: true as const };
    });
  });

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------
export const listSocialAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CandidateInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    return safeSocialRun("listSocialAlerts", { candidate_id: data.candidate_id ?? null }, async () => {
      const candidateId = await resolveSocialCandidateId(supabase, userId, data.candidate_id ?? null);
      const { data: rows, error } = await supabase
        .from("social_alerts")
        .select("*")
        .eq("candidate_id", candidateId)
        .eq("is_dismissed", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return { ok: true as const, alerts: rows ?? [] };
    });
  });

// ---------------------------------------------------------------------------
// Operação
// ---------------------------------------------------------------------------
export const getSocialOpsStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    return safeSocialRun("getSocialOpsStats", {}, async () => {
      const { data: stats, error } = await supabase.rpc("social_dashboard_stats");
      if (error) throw new Error(error.message);
      return { ok: true as const, stats };
    });
  });

export const forceEnqueueSocial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CandidateInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    return safeSocialRun("forceEnqueueSocial", { candidate_id: data.candidate_id ?? null }, async () => {
      const candidateId = await resolveSocialCandidateId(supabase, userId, data.candidate_id ?? null);

      const { data: profiles, error: pErr } = await supabase
        .from("social_profiles")
        .select("id")
        .eq("candidate_id", candidateId)
        .eq("is_active", true);
      if (pErr) throw new Error(pErr.message);
      if (!profiles || profiles.length === 0) {
        return { ok: true as const, enqueued: 0, message: "Nenhum perfil ativo." };
      }

      const env = socialEnvStatus();
      if (!env.hasSupabaseServiceRoleKey) {
        return {
          ok: false as const,
          enqueued: 0,
          message: "Fila social indisponível: SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.",
          stage: "forceEnqueueSocial.missing_service_role",
          details: { env },
        };
      }

      const { enqueued } = await enqueueMissingSocialCollections(
        candidateId,
        (profiles ?? []).map((profile: { id: string }) => profile.id),
      );

      await supabase
        .from("social_profiles")
        .update({ last_checked_at: null })
        .eq("candidate_id", candidateId)
        .eq("is_active", true);

      return { ok: true as const, enqueued, message: `${enqueued} job(s) criado(s).` };
    });
  });
