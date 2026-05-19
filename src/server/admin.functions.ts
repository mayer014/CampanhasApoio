import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeSupabaseUrl } from "@/integrations/supabase/url";
import { uniqueSlug } from "./admin.server";
import type { Database } from "@/integrations/supabase/types";

import { userIdFromJwt } from "@/lib/jwt-decode.server";

async function getUserIdFromToken(token: string): Promise<string> {
  return userIdFromJwt(token);
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
