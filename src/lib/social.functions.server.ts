import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logSocialError, socialDebugPayload, socialEnvStatus } from "./social.server";

type SocialFailure = { ok: false; message: string; details: any; stage: string };

export function getSocialErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
    return (error as any).message;
  }
  return "Erro interno";
}

export function isDuplicateSocialProfileError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as any;
  const code = typeof e.code === "string" ? e.code : "";
  const msg = typeof e.message === "string" ? e.message : "";
  const det = typeof e.details === "string" ? e.details : "";
  return code === "23505" || /duplicate key/i.test(msg) || /duplicate key/i.test(det);
}

export async function resolveSocialCandidateId(
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

export async function safeSocialRun<T>(
  location: string,
  extra: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T | SocialFailure> {
  try {
    return await fn();
  } catch (error) {
    const message = isDuplicateSocialProfileError(error)
      ? "Perfil já cadastrado"
      : getSocialErrorMessage(error);
    const details = socialDebugPayload(location, error, extra);
    logSocialError(location, error, extra);
    return { ok: false, stage: location, message, details };
  }
}

export async function enqueueInitialSocialCollection(candidateId: string, profileId: string) {
  const env = socialEnvStatus();
  if (!env.hasSupabaseServiceRoleKey) return;

  try {
    await supabaseAdmin.from("social_jobs").insert({
      candidate_id: candidateId,
      profile_id: profileId,
      job_type: "crawl_profile",
      priority: 25,
      scheduled_at: new Date().toISOString(),
    });
  } catch (error) {
    logSocialError("createSocialProfile.enqueue", error, { profile_id: profileId });
  }
}

export async function enqueueMissingSocialCollections(candidateId: string, profileIds: string[]) {
  const env = socialEnvStatus();
  if (!env.hasSupabaseServiceRoleKey) {
    return { env, enqueued: 0 };
  }

  let enqueued = 0;

  for (const profileId of profileIds) {
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("social_jobs")
      .select("id")
      .eq("profile_id", profileId)
      .in("status", ["pending", "running"])
      .limit(1)
      .maybeSingle();

    if (existingErr) throw new Error(existingErr.message);
    if (existing) continue;

    const { error: insErr } = await supabaseAdmin.from("social_jobs").insert({
      candidate_id: candidateId,
      profile_id: profileId,
      job_type: "crawl_profile",
      priority: 50,
      scheduled_at: new Date().toISOString(),
    });

    if (insErr) throw new Error(insErr.message);
    enqueued++;
  }

  return { env, enqueued };
}