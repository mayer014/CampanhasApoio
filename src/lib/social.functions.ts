// Server functions for Social Intelligence Engine.
// Todas usam requireSupabaseAuth para herdar token + supabase client autenticado
// (sem import dinâmico e sem criar client a cada request).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logSocialError, socialDebugPayload, socialEnvStatus } from "./social.server";

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
    return (error as any).message;
  }
  return "Erro interno";
}

function isDuplicateProfileError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as any;
  const code = typeof e.code === "string" ? e.code : "";
  const msg = typeof e.message === "string" ? e.message : "";
  const det = typeof e.details === "string" ? e.details : "";
  return code === "23505" || /duplicate key/i.test(msg) || /duplicate key/i.test(det);
}

async function resolveCandidateId(
  sb: SupabaseClient,
  callerId: string,
  requested?: string | null,
): Promise<string> {
  if (!requested || requested === callerId) return callerId;
  const { data } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
  return requested;
}

// Wrap padrão: garante que QUALQUER throw vire um JSON serializável.
async function safeRun<T>(
  location: string,
  extra: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T | { ok: false; message: string; details: any; stage: string }> {
  try {
    return await fn();
  } catch (error) {
    const message = isDuplicateProfileError(error) ? "Perfil já cadastrado" : getErrorMessage(error);
    const details = socialDebugPayload(location, error, extra);
    logSocialError(location, error, extra);
    return { ok: false, stage: location, message, details };
  }
}

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
      checks.profiles_table = { ok: false, message: getErrorMessage(e) };
    }

    try {
      const { error } = await supabase.rpc("social_dashboard_stats");
      checks.dashboard_rpc = { ok: !error, message: error?.message };
    } catch (e) {
      checks.dashboard_rpc = { ok: false, message: getErrorMessage(e) };
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
    return safeRun("listSocialProfiles", { candidate_id: data.candidate_id ?? null }, async () => {
      const candidateId = await resolveCandidateId(supabase, userId, data.candidate_id ?? null);
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

    return safeRun("createSocialProfile", { username }, async () => {
      const candidateId = await resolveCandidateId(supabase, userId, data.candidate_id ?? null);

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
        if (isDuplicateProfileError(error)) throw new Error("Perfil já cadastrado");
        throw new Error(error.message);
      }

      // Enfileira coleta inicial (best-effort, só se service role estiver disponível).
      const env = socialEnvStatus();
      if (env.hasSupabaseServiceRoleKey) {
        try {
          await supabaseAdmin.from("social_jobs").insert({
            candidate_id: candidateId,
            profile_id: row.id,
            job_type: "crawl_profile",
            priority: 25,
            scheduled_at: new Date().toISOString(),
          });
        } catch (e) {
          logSocialError("createSocialProfile.enqueue", e, { profile_id: row.id });
        }
      }

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
    return safeRun("toggleSocialProfile", { profile_id: data.profile_id }, async () => {
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
    return safeRun("deleteSocialProfile", { profile_id: data.profile_id }, async () => {
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
    return safeRun("listSocialAlerts", { candidate_id: data.candidate_id ?? null }, async () => {
      const candidateId = await resolveCandidateId(supabase, userId, data.candidate_id ?? null);
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
    return safeRun("getSocialOpsStats", {}, async () => {
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
    return safeRun("forceEnqueueSocial", { candidate_id: data.candidate_id ?? null }, async () => {
      const candidateId = await resolveCandidateId(supabase, userId, data.candidate_id ?? null);

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

      let enqueued = 0;
      for (const p of profiles) {
        const { data: existing, error: existingErr } = await supabaseAdmin
          .from("social_jobs")
          .select("id")
          .eq("profile_id", p.id)
          .in("status", ["pending", "running"])
          .limit(1)
          .maybeSingle();
        if (existingErr) throw new Error(existingErr.message);
        if (existing) continue;
        const { error: insErr } = await supabaseAdmin.from("social_jobs").insert({
          candidate_id: candidateId,
          profile_id: p.id,
          job_type: "crawl_profile",
          priority: 50,
          scheduled_at: new Date().toISOString(),
        });
        if (insErr) throw new Error(insErr.message);
        enqueued++;
      }

      await supabase
        .from("social_profiles")
        .update({ last_checked_at: null })
        .eq("candidate_id", candidateId)
        .eq("is_active", true);

      return { ok: true as const, enqueued, message: `${enqueued} job(s) criado(s).` };
    });
  });
