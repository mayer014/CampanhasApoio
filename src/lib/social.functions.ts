import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PlatformEnum = z.enum(["instagram", "tiktok", "facebook", "youtube", "twitter"]);

export const listSocialProfiles = createServerFn({ method: "GET" })
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
  .inputValidator((input) =>
    z
      .object({
        platform: PlatformEnum,
        username: z.string().min(1).max(120).regex(/^[A-Za-z0-9._-]+$/),
        is_own: z.boolean().default(true),
        check_interval_minutes: z.number().int().min(30).max(10080).default(360),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("social_profiles")
      .insert({
        candidate_id: userId,
        platform: data.platform,
        username: data.username,
        is_own: data.is_own,
        check_interval_minutes: data.check_interval_minutes,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { profile: row };
  });

export const updateSocialProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        is_active: z.boolean().optional(),
        check_interval_minutes: z.number().int().min(30).max(10080).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: { is_active?: boolean; check_interval_minutes?: number } = {};
    if (data.is_active !== undefined) patch.is_active = data.is_active;
    if (data.check_interval_minutes !== undefined) patch.check_interval_minutes = data.check_interval_minutes;
    const { error } = await supabase.from("social_profiles").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteSocialProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("social_profiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const listSocialPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        profile_id: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("social_posts")
      .select("*")
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (data.profile_id) q = q.eq("profile_id", data.profile_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { posts: rows ?? [] };
  });

export const getSocialDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("social_dashboard_stats");
    if (error) throw new Error(error.message);
    return { stats: data };
  });
