import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProfileType = z.enum(["own_profile", "competitor", "portal", "influencer"]);

export const listSocialProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("social_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { profiles: data ?? [] };
  });

export const addSocialProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      username: z.string().min(1).max(60).regex(/^[a-zA-Z0-9._]+$/),
      profile_type: ProfileType.default("competitor"),
      check_interval_minutes: z.number().int().min(30).max(1440).default(360),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const username = data.username.toLowerCase();
    const { data: row, error } = await supabase
      .from("social_profiles")
      .insert({
        candidate_id: userId,
        platform: "instagram",
        username,
        profile_type: data.profile_type,
        is_own: data.profile_type === "own_profile",
        check_interval_minutes: data.check_interval_minutes,
        is_active: true,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { profile: row };
  });

export const updateSocialProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      is_active: z.boolean().optional(),
      profile_type: ProfileType.optional(),
      check_interval_minutes: z.number().int().min(30).max(1440).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const upd: {
      is_active?: boolean;
      profile_type?: "own_profile" | "competitor" | "portal" | "influencer";
      is_own?: boolean;
      check_interval_minutes?: number;
    } = {};
    if (data.is_active !== undefined) upd.is_active = data.is_active;
    if (data.profile_type !== undefined) {
      upd.profile_type = data.profile_type;
      upd.is_own = data.profile_type === "own_profile";
    }
    if (data.check_interval_minutes !== undefined) upd.check_interval_minutes = data.check_interval_minutes;
    const { error } = await supabase.from("social_profiles").update(upd).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSocialProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("social_profiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSocialPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      profile_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(100).default(48),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("social_posts")
      .select("id, profile_id, external_id, post_url, caption, thumbnail_url, likes, comments, views, posted_at, first_seen_at, hashtags")
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (data.profile_id) q = q.eq("profile_id", data.profile_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { posts: rows ?? [] };
  });

export const getSocialDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("social_dashboard_stats");
    if (error) throw new Error(error.message);

    const { data: alerts } = await supabase
      .from("social_alerts")
      .select("id, alert_type, severity, title, message, created_at, profile_id, post_id, data")
      .order("created_at", { ascending: false })
      .limit(20);

    return { stats: data, alerts: alerts ?? [] };
  });

export const enqueueSocialProfileNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ profile_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Ensure the profile belongs to the caller
    const { data: profile, error: pErr } = await supabase
      .from("social_profiles")
      .select("id, candidate_id, is_active")
      .eq("id", data.profile_id)
      .single();
    if (pErr || !profile) throw new Error("Perfil não encontrado");
    if (profile.candidate_id !== userId) throw new Error("Sem permissão");
    if (!profile.is_active) throw new Error("Perfil está inativo");

    // Avoid duplicates: don't enqueue if there's already a pending/running job
    const { data: existing } = await supabase
      .from("social_jobs")
      .select("id, status")
      .eq("profile_id", data.profile_id)
      .in("status", ["pending", "running"])
      .limit(1);
    if (existing && existing.length > 0) {
      return { ok: true, job_id: existing[0].id, reused: true };
    }

    const { data: job, error: jErr } = await supabase
      .from("social_jobs")
      .insert({
        candidate_id: userId,
        profile_id: data.profile_id,
        job_type: "crawl_profile",
        status: "pending",
        priority: 10, // higher than default 100 (lower number = sooner)
        scheduled_at: new Date().toISOString(),
        payload: { manual: true },
      })
      .select("id")
      .single();
    if (jErr) throw new Error(jErr.message);

    return { ok: true, job_id: job.id, reused: false };
  });

