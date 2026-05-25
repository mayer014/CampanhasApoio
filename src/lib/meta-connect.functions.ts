import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildMetaOAuthUrl, META_APP_ID, META_REDIRECT_URI, META_GRAPH_VERSION } from "./meta-oauth";

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const STATE_TTL_MS = 10 * 60 * 1000; // 10 min

function stateSecret() {
  const s = process.env.SOCIAL_HMAC_SECRET || process.env.META_APP_SECRET;
  if (!s) throw new Error("SOCIAL_HMAC_SECRET (ou META_APP_SECRET) não configurado.");
  return s;
}

function b64url(buf: Buffer | string) {
  return Buffer.from(buf).toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

function signState(userId: string): string {
  const payload = { uid: userId, exp: Date.now() + STATE_TTL_MS, n: Math.random().toString(36).slice(2, 10) };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", stateSecret()).update(body).digest());
  return `${body}.${sig}`;
}

function verifyState(state: string): { uid: string } {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("State inválido.");
  const expected = b64url(createHmac("sha256", stateSecret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Assinatura do state inválida.");
  const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as { uid?: string; exp?: number };
  if (!payload.uid || !payload.exp) throw new Error("Payload do state inválido.");
  if (Date.now() > payload.exp) throw new Error("State expirado. Tente conectar novamente.");
  return { uid: payload.uid };
}

type TokenResponse = { access_token: string; token_type?: string; expires_in?: number };
type DebugTokenResponse = {
  data?: {
    app_id?: string;
    user_id?: string;
    scopes?: string[];
    granular_scopes?: Array<{ scope?: string; target_ids?: string[]; expired_time?: number }>;
    data_access_expires_at?: number;
    expires_at?: number;
    is_valid?: boolean;
  };
};
type FbError = { error?: { message?: string; type?: string; code?: number } };

async function fbJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json()) as T & FbError;
  if (!res.ok || (json as FbError).error) {
    const msg = (json as FbError).error?.message || `Erro Graph API (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Gera apenas o `state` assinado e o `config_id` para que o cliente monte
 * a URL OAuth da Meta sem jamais abrir `/_serverFn` dentro do popup.
 */
export const getMetaOAuthState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const configId = process.env.META_BUSINESS_LOGIN_CONFIG_ID ?? null;
    const signed = signState(context.userId);
    return {
      state: signed,
      configId,
    };
  });

export const getMetaOAuthUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const configId = process.env.META_BUSINESS_LOGIN_CONFIG_ID ?? null;
    const signed = signState(context.userId);
    return {
      url: buildMetaOAuthUrl({ state: signed, configId }),
      configId,
    };
  });

async function exchangeCodeAndSave(userId: string, code: string) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) throw new Error("META_APP_SECRET não configurado no servidor.");

  // 1) Trocar code por user access_token
  const tokenUrl =
    `${GRAPH}/oauth/access_token?` +
    new URLSearchParams({
      client_id: META_APP_ID,
      client_secret: appSecret,
      redirect_uri: META_REDIRECT_URI,
      code,
    }).toString();

  const tokenRes = await fbJson<TokenResponse>(tokenUrl);
  const userAccessToken = tokenRes.access_token;
  const userExpiresIn = tokenRes.expires_in ?? 0;

  // 2) Long-lived (60 dias)
  let longLivedToken = userAccessToken;
  let longLivedExpiresIn = userExpiresIn;
  try {
    const ll = await fbJson<TokenResponse>(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: META_APP_ID,
          client_secret: appSecret,
          fb_exchange_token: userAccessToken,
        }).toString(),
    );
    longLivedToken = ll.access_token;
    longLivedExpiresIn = ll.expires_in ?? userExpiresIn;
  } catch { /* mantém short-lived */ }

  // 3) Debug token
  const debugToken = await fbJson<DebugTokenResponse>(
    `${GRAPH}/debug_token?` +
      new URLSearchParams({
        input_token: longLivedToken,
        access_token: `${META_APP_ID}|${appSecret}`,
      }).toString(),
  );
  const tokenDebug = debugToken.data ?? {};
  console.info("[meta-oauth] token debug", {
    is_valid: tokenDebug.is_valid ?? false,
    app_id: tokenDebug.app_id ?? null,
    user_id: tokenDebug.user_id ?? null,
    scopes: tokenDebug.scopes ?? [],
    granular_scopes: tokenDebug.granular_scopes ?? [],
    data_access_expires_at: tokenDebug.data_access_expires_at ?? null,
  });

  // 4) Páginas
  const pagesRes = await fbJson<{
    data?: Array<{
      id: string;
      name: string;
      access_token: string;
      tasks?: string[];
      instagram_business_account?: { id: string };
    }>;
  }>(
    `${GRAPH}/me/accounts?` +
      new URLSearchParams({
        fields: "id,name,access_token,tasks,instagram_business_account",
        access_token: longLivedToken,
      }).toString(),
  );
  const pages = pagesRes.data ?? [];
  if (pages.length === 0) {
    const diag = {
      message:
        "Nenhuma página do Facebook foi retornada por /me/accounts. Verifique scopes/permissões concedidas.",
      token_debug: {
        is_valid: tokenDebug.is_valid ?? false,
        app_id: tokenDebug.app_id ?? null,
        user_id: tokenDebug.user_id ?? null,
        scopes: tokenDebug.scopes ?? [],
        granular_scopes: tokenDebug.granular_scopes ?? [],
        data_access_expires_at: tokenDebug.data_access_expires_at ?? null,
      },
      me_accounts_raw: pagesRes,
    };
    console.error("[meta-oauth] /me/accounts vazio", diag);
    throw new Error("META_DIAG:" + JSON.stringify(diag));
  }

  const page = pages[0];
  const pageAccessToken = page.access_token;
  const instagramBusinessId = page.instagram_business_account?.id ?? null;

  let instagramUsername: string | null = null;
  let instagramPictureUrl: string | null = null;
  if (instagramBusinessId) {
    try {
      const ig = await fbJson<{ id: string; username?: string; profile_picture_url?: string }>(
        `${GRAPH}/${instagramBusinessId}?` +
          new URLSearchParams({
            fields: "id,username,profile_picture_url",
            access_token: pageAccessToken,
          }).toString(),
      );
      instagramUsername = ig.username ?? null;
      instagramPictureUrl = ig.profile_picture_url ?? null;
    } catch { /* opcional */ }
  }

  let pagePictureUrl: string | null = null;
  try {
    const pic = await fbJson<{ data?: { url?: string } }>(
      `${GRAPH}/${page.id}/picture?redirect=false&type=large&access_token=${pageAccessToken}`,
    );
    pagePictureUrl = pic.data?.url ?? null;
  } catch { /* opcional */ }

  const expiresAt =
    longLivedExpiresIn > 0 ? new Date(Date.now() + longLivedExpiresIn * 1000).toISOString() : null;

  const row = {
    user_id: userId,
    platform: "meta",
    access_token: pageAccessToken,
    page_id: page.id,
    page_name: page.name,
    page_picture_url: pagePictureUrl,
    instagram_business_id: instagramBusinessId,
    instagram_username: instagramUsername,
    instagram_picture_url: instagramPictureUrl,
    expires_at: expiresAt,
    status: page.id ? "connected" : "disconnected",
    metadata: {
      source: "code_oauth",
      granted_at: new Date().toISOString(),
      user_access_token_expires_in: longLivedExpiresIn,
      pages_count: pages.length,
      page_tasks: page.tasks ?? [],
      token_debug: {
        is_valid: tokenDebug.is_valid ?? false,
        app_id: tokenDebug.app_id ?? null,
        user_id: tokenDebug.user_id ?? null,
        scopes: tokenDebug.scopes ?? [],
        granular_scopes:
          tokenDebug.granular_scopes?.map((s) => ({
            scope: s.scope ?? null,
            target_ids: s.target_ids ?? [],
            expired_time: s.expired_time ?? null,
          })) ?? [],
        data_access_expires_at: tokenDebug.data_access_expires_at ?? null,
      },
    },
  };

  const { error: upErr } = await supabaseAdmin
    .from("social_connections")
    .upsert(row, { onConflict: "user_id,platform" });
  if (upErr) throw new Error(upErr.message);

  return {
    ok: true,
    page_id: page.id,
    page_name: page.name,
    instagram_business_id: instagramBusinessId,
    instagram_username: instagramUsername,
    expires_at: expiresAt,
  };
}

/**
 * Versão autenticada: usa a sessão Supabase do navegador (o popup compartilha
 * localStorage com a janela principal). O `state` é validado client-side.
 */
export const connectMetaAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().min(10).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    return exchangeCodeAndSave(context.userId, data.code);
  });

/**
 * Versão com state assinado HMAC (mantida para compatibilidade).
 */
export const connectMetaAccountWithState = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().min(10).max(2000),
        state: z.string().min(10).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { uid: userId } = verifyState(data.state);
    return exchangeCodeAndSave(userId, data.code);
  });

