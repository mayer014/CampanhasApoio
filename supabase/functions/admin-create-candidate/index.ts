// Edge Function: admin-only — creates a candidate (auth user + profile + role + subscription).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function uniqueSlug(admin: any, base: string, fallbackId: string): Promise<string> {
  let baseSlug = base ? slugify(base) : "";
  if (!baseSlug) baseSlug = fallbackId.slice(0, 8);
  let finalSlug = baseSlug;
  let i = 1;
  while (true) {
    const { data: exists } = await admin
      .from("candidate_profiles")
      .select("id")
      .eq("slug", finalSlug)
      .maybeSingle();
    if (!exists) return finalSlug;
    i++;
    finalSlug = `${baseSlug}-${i}`;
    if (i > 50) return `${baseSlug}-${fallbackId.slice(0, 6)}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    // Verify caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Confirm caller is admin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, password, full_name, phone, slug } = body ?? {};
    if (!email || !password || !full_name || password.length < 8) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message || "Failed to create user");
    }
    const newUserId = created.user.id;

    const finalSlug = await uniqueSlug(admin, slug || full_name, newUserId);

    const { error: profErr } = await admin.from("candidate_profiles").insert({
      id: newUserId,
      full_name,
      phone: phone || null,
      email,
      slug: finalSlug,
    });
    if (profErr) {
      await admin.auth.admin.deleteUser(newUserId);
      throw new Error("Profile creation failed: " + profErr.message);
    }

    await admin.from("user_roles").insert({ user_id: newUserId, role: "candidate" });
    await admin.from("subscriptions").insert({ candidate_id: newUserId, status: "active" });

    return new Response(JSON.stringify({ success: true, user_id: newUserId, slug: finalSlug }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
