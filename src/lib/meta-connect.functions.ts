import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { META_APP_ID, META_REDIRECT_URI, META_GRAPH_VERSION } from "./meta-oauth";

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const STATE_TTL_MS = 10 * 60 * 1000;

function stateSecret() {
  const s = process.env.SOCIAL_HMAC_SECRET || process.env.META_APP_SECRET;
  if (!s) throw new Error("SOCIAL_HMAC_SECRET (ou META_APP_SECRET) não configurado.");
  return s;
}

// Web Crypto API — compatível com Cloudflare Workers (workerd) e Node 20+.
// Substitui `node:crypto` que era externalizado pelo Vite e quebrava o build.
function bytesToB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64UrlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}
function bytesToStr(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}
function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    strToBytes(secret).buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, strToBytes(data).buffer as ArrayBuffer);
  return new Uint8Array(sig);
}

export async function signState(userId: string): Promise<string> {
  const payload = { uid: userId, exp: Date.now() + STATE_TTL_MS, n: Math.random().toString(36).slice(2, 10) };
  const body = bytesToB64Url(strToBytes(JSON.stringify(payload)));
  const sig = bytesToB64Url(await hmacSha256(stateSecret(), body));
  return `${body}.${sig}`;
}

async function verifyState(state: string): Promise<{ uid: string }> {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("State inválido.");
  const expected = bytesToB64Url(await hmacSha256(stateSecret(), body));
  if (!timingSafeEqualBytes(strToBytes(sig), strToBytes(expected))) {
    throw new Error("Assinatura do state inválida.");
  }
  const payload = JSON.parse(bytesToStr(b64UrlToBytes(body))) as { uid?: string; exp?: number };
  if (!payload.uid || !payload.exp) throw new Error("Payload do state inválido.");
  if (Date.now() > payload.exp) throw new Error("State expirado. Tente conectar novamente.");
  return { uid: payload.uid };
}

type TokenResponse = { access_token: string; token_type?: string; expires_in?: number };
type FbError = { error?: { message?: string; type?: string; code?: number; error_subcode?: number } };

async function fbJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = (await res.json()) as T & FbError;
  if (!res.ok || (json as FbError).error) {
    const msg = (json as FbError).error?.message || `Erro Graph API (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

function tokenFingerprint(t: string): string {
  if (!t) return "";
  return `${t.slice(0, 6)}…${t.slice(-4)} (len=${t.length})`;
}

async function debugTokenRaw(token: string, appAccess: string): Promise<unknown> {
  const url = `${GRAPH}/debug_token?` + new URLSearchParams({ input_token: token, access_token: appAccess }).toString();
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  return json;
}

async function exchangeCodeAndSave(userId: string, code: string) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) throw new Error("META_APP_SECRET não configurado no servidor.");
  const appAccess = `${META_APP_ID}|${appSecret}`;

  // 1) code -> short-lived user token
  const tokenUrl =
    `${GRAPH}/oauth/access_token?` +
    new URLSearchParams({
      client_id: META_APP_ID,
      client_secret: appSecret,
      redirect_uri: META_REDIRECT_URI,
      code,
    }).toString();
  const tokenRes = await fbJson<TokenResponse>(tokenUrl);
  const shortToken = tokenRes.access_token;
  const shortExpiresIn = tokenRes.expires_in ?? 0;

  // 2) debug do token curto
  const shortDebug = await debugTokenRaw(shortToken, appAccess);

  // 3) tentar long-lived
  let longToken = shortToken;
  let longExpiresIn = shortExpiresIn;
  let longLivedAttempted = false;
  let longLivedError: string | null = null;
  try {
    longLivedAttempted = true;
    const ll = await fbJson<TokenResponse>(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: META_APP_ID,
          client_secret: appSecret,
          fb_exchange_token: shortToken,
        }).toString(),
    );
    longToken = ll.access_token;
    longExpiresIn = ll.expires_in ?? shortExpiresIn;
  } catch (e) {
    longLivedError = e instanceof Error ? e.message : "fb_exchange_token falhou";
  }

  // 4) debug do token longo
  const longDebug = await debugTokenRaw(longToken, appAccess);

  // 5) /me/accounts — captura URL, status, headers e corpo bruto
  const meAccountsUrl =
    `${GRAPH}/me/accounts?` +
    new URLSearchParams({
      fields: "id,name,access_token,tasks,instagram_business_account",
      access_token: longToken,
    }).toString();
  const meRes = await fetch(meAccountsUrl);
  const meHeaders: Record<string, string> = {};
  meRes.headers.forEach((v, k) => {
    const kk = k.toLowerCase();
    if (
      kk.startsWith("x-") ||
      kk === "www-authenticate" ||
      kk === "content-type" ||
      kk === "facebook-api-version"
    ) {
      meHeaders[k] = v;
    }
  });
  const meBody = (await meRes.json().catch(() => ({}))) as {
    data?: Array<{
      id: string;
      name: string;
      access_token: string;
      tasks?: string[];
      instagram_business_account?: { id: string };
    }>;
    paging?: unknown;
    error?: unknown;
  };
  const pages = meBody.data ?? [];

  console.info("[meta-oauth] diag", {
    short_token_fp: tokenFingerprint(shortToken),
    long_token_fp: tokenFingerprint(longToken),
    long_lived_attempted: longLivedAttempted,
    long_lived_error: longLivedError,
    short_debug: shortDebug,
    long_debug: longDebug,
    me_accounts: {
      url: `${GRAPH}/me/accounts?fields=id,name,access_token,tasks,instagram_business_account&access_token=<redacted>`,
      status: meRes.status,
      headers: meHeaders,
      body: meBody,
      pages_count: pages.length,
    },
  });

  if (pages.length === 0) {
    const diag = {
      message:
        "Nenhuma página retornada por /me/accounts. Veja os blocos abaixo para confirmar a causa.",
      short_token: { fingerprint: tokenFingerprint(shortToken), expires_in: shortExpiresIn },
      long_token: {
        fingerprint: tokenFingerprint(longToken),
        expires_in: longExpiresIn,
        long_lived_attempted: longLivedAttempted,
        long_lived_error: longLivedError,
      },
      debug_token_short: shortDebug,
      debug_token_long: longDebug,
      me_accounts: {
        request_url: `${GRAPH}/me/accounts?fields=id,name,access_token,tasks,instagram_business_account&access_token=<redacted>`,
        status: meRes.status,
        headers: meHeaders,
        body: meBody,
        pages_count: pages.length,
      },
    };
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
    longExpiresIn > 0 ? new Date(Date.now() + longExpiresIn * 1000).toISOString() : null;

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
      user_access_token_expires_in: longExpiresIn,
      pages_count: pages.length,
      page_tasks: page.tasks ?? [],
      debug_token_short: shortDebug,
      debug_token_long: longDebug,
    },
  };

  const { error: upErr } = await supabaseAdmin
    .from("social_connections")
    .upsert(row as never, { onConflict: "user_id,platform" });
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

export const connectMetaAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().min(10).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    return exchangeCodeAndSave(context.userId, data.code);
  });

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
    const { uid: userId } = await verifyState(data.state);
    return exchangeCodeAndSave(userId, data.code);
  });
