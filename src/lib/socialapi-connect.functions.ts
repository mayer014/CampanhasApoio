import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const platformSchema = z.enum(["facebook", "instagram"]);

function randomState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function callbackUrl(): string {
  const base = process.env.APP_BASE_URL ?? process.env.PUBLIC_BASE_URL;
  if (!base) throw new Error("APP_BASE_URL não configurado no servidor.");
  return `${base.replace(/\/+$/, "")}/auth/socialapi/callback`;
}

export const startSocialConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ platform: platformSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { socialApiStart } = await import("./socialapi.server");
    const state = randomState();

    const { error: insErr } = await context.supabase
      .from("socialapi_oauth_states" as never)
      .insert({ state, user_id: context.userId, platform: data.platform } as never);
    if (insErr) throw new Error(`Falha ao registrar state: ${insErr.message}`);

    const redirect_uri = callbackUrl();
    const { auth_url } = await socialApiStart({ platform: data.platform, redirect_uri, state });
    return { auth_url };
  });

export const completeSocialConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().min(4).max(4000), state: z.string().min(16).max(512) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { socialApiExchange } = await import("./socialapi.server");

    // Validate state belongs to this user and is fresh (<10 min).
    const { data: stateRow, error: stErr } = await context.supabase
      .from("socialapi_oauth_states" as never)
      .select("state,user_id,platform,created_at")
      .eq("state", data.state)
      .maybeSingle();
    if (stErr) throw new Error(`Falha ao ler state: ${stErr.message}`);
    if (!stateRow) throw new Error("State OAuth inválido ou expirado.");
    const row = stateRow as unknown as { user_id: string; platform: string; created_at: string };
    if (row.user_id !== context.userId) throw new Error("State OAuth não pertence ao usuário atual.");
    const ageMs = Date.now() - new Date(row.created_at).getTime();
    if (ageMs > 10 * 60 * 1000) throw new Error("State OAuth expirado (>10 min).");

    const account = await socialApiExchange({
      code: data.code,
      state: data.state,
      redirect_uri: callbackUrl(),
    });

    const upsertRow = {
      user_id: context.userId,
      platform: "meta",
      access_token: account.access_token,
      page_id: account.page_id ?? null,
      page_name: account.page_name ?? null,
      page_picture_url: account.page_picture_url ?? null,
      instagram_business_id: account.instagram_business_id ?? null,
      instagram_username: account.instagram_username ?? null,
      instagram_picture_url: account.instagram_picture_url ?? null,
      expires_at: account.expires_at ?? null,
      status: "connected",
      metadata: {
        source: "socialapi",
        socialapi_account_id: account.account_id,
        socialapi_platform: account.platform,
        granted_at: new Date().toISOString(),
      },
    };

    const { error: upErr } = await context.supabase
      .from("social_connections")
      .upsert(upsertRow as never, { onConflict: "user_id,platform" });
    if (upErr) throw new Error(`Falha ao salvar social_connection: ${upErr.message}`);

    await context.supabase
      .from("socialapi_oauth_states" as never)
      .delete()
      .eq("state", data.state);

    return {
      ok: true,
      page_id: account.page_id ?? null,
      page_name: account.page_name ?? null,
      instagram_username: account.instagram_username ?? null,
      expires_at: account.expires_at ?? null,
    };
  });

export const disconnectSocial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ connection_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { socialApiRevoke } = await import("./socialapi.server");

    const { data: connRow, error: selErr } = await context.supabase
      .from("social_connections")
      .select("id,user_id,metadata")
      .eq("id", data.connection_id)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!connRow) throw new Error("Conexão não encontrada.");
    if ((connRow as { user_id: string }).user_id !== context.userId) {
      throw new Error("Conexão não pertence ao usuário atual.");
    }

    const meta = (connRow as { metadata: unknown }).metadata as { socialapi_account_id?: string } | null;
    const accountId = meta?.socialapi_account_id;
    if (accountId) {
      try { await socialApiRevoke(accountId); } catch (e) {
        console.warn("[socialapi] revoke falhou (ignorado)", e);
      }
    }

    const { error: delErr } = await context.supabase
      .from("social_connections")
      .delete()
      .eq("id", data.connection_id);
    if (delErr) throw new Error(delErr.message);

    return { ok: true };
  });
