import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeSupabaseUrl } from "@/integrations/supabase/url";
import { uniqueSlug } from "./admin.server";
import type { Database } from "@/integrations/supabase/types";

async function getUserIdFromToken(token: string): Promise<string> {
  const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmcHBta3FzZHFhd3Z5a2tnYWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjM3MzcsImV4cCI6MjA5MzE5OTczN30.LkEeROQWXN2HkRsEiiI4sjzBQf4OdDVuuCep48wL3Rg";
  const SUPABASE_URL =
    normalizeSupabaseUrl(process.env.SUPABASE_URL) ||
    normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL) ||
    "https://pfppmkqsdqawvykkgafe.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    FALLBACK_SUPABASE_PUBLISHABLE_KEY;
  const sb = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid or expired token");
  return data.user.id;
}

/**
 * Bootstrap the FIRST admin: promotes the calling authenticated user
 * to admin role. Only works while no admin exists yet.
 */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ access_token: z.string().min(10) }).parse(input)
  )
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.access_token);

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if ((count ?? 0) > 0) {
      throw new Error("Admin already exists. Bootstrap is closed.");
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });

    if (error) throw new Error(error.message);
    return { success: true, user_id: userId };
  });

const CreateCandidateSchema = z.object({
  access_token: z.string().min(10),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  full_name: z.string().min(1).max(150),
  phone: z.string().max(40).optional().nullable(),
  slug: z.string().max(60).optional().nullable(),
});

/**
 * Admin-only: create a candidate user (auth + profile + role + subscription).
 */
export const adminCreateCandidate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateCandidateSchema.parse(input))
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data.access_token);

    // Verify caller is admin
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden: admin only");

    const { email, password, full_name, phone, slug } = data;

    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
    if (createErr || !created.user) {
      throw new Error(createErr?.message || "Failed to create user");
    }

    const newUserId = created.user.id;
    const finalSlug = await uniqueSlug(slug || full_name, newUserId);

    const { error: profErr } = await supabaseAdmin
      .from("candidate_profiles")
      .insert({
        id: newUserId,
        full_name,
        phone: phone || null,
        email,
        slug: finalSlug,
      });
    if (profErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error("Profile creation failed: " + profErr.message);
    }

    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "candidate" });

    await supabaseAdmin
      .from("subscriptions")
      .insert({ candidate_id: newUserId, status: "active" });

    return { success: true, user_id: newUserId, slug: finalSlug };
  });
