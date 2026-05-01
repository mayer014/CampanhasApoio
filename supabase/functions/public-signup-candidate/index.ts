// Edge Function: public — anyone can sign up as a candidate (free trial of 5 photos).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const recentByIp = new Map<string, number>();

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

    // Best-effort rate limit per IP (30s)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const now = Date.now();
    const last = recentByIp.get(ip) ?? 0;
    if (now - last < 30_000) {
      return new Response(
        JSON.stringify({ error: "Aguarde alguns segundos antes de tentar novamente." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    recentByIp.set(ip, now);

    const body = await req.json();
    const full_name = String(body?.full_name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const phone = String(body?.phone ?? "").trim();
    const city = String(body?.city ?? "").trim();
    const state = String(body?.state ?? "").trim().toUpperCase();

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const stateOk = /^[A-Z]{2}$/.test(state);

    if (
      full_name.length < 3 || full_name.length > 120 ||
      !emailOk || email.length > 255 ||
      password.length < 8 || password.length > 200 ||
      phone.length < 8 || phone.length > 20 ||
      city.length < 2 || city.length > 80 ||
      !stateOk
    ) {
      return new Response(JSON.stringify({ error: "Dados inválidos. Verifique os campos." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr || !created.user) {
      const msg = createErr?.message || "Falha ao criar usuário";
      const status = msg.toLowerCase().includes("already") ? 409 : 400;
      return new Response(
        JSON.stringify({ error: status === 409 ? "Este e-mail já está cadastrado." : msg }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const newUserId = created.user.id;

    const finalSlug = await uniqueSlug(admin, full_name, newUserId);

    const { error: profErr } = await admin.from("candidate_profiles").insert({
      id: newUserId,
      full_name,
      phone,
      email,
      slug: finalSlug,
      city,
      state,
      signup_source: "public",
      trial_limit: 5,
      is_blocked: false,
    });
    if (profErr) {
      await admin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: "Falha ao criar perfil: " + profErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("user_roles").insert({ user_id: newUserId, role: "candidate" });

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
