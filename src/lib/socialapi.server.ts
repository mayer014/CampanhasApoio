// Server-only HTTP client for SocialAPI.ai.
// NEVER import this from browser code — reads SOCIALAPI_API_KEY from process.env.
//
// The exact endpoints/payloads below are placeholders. Substitua pelos valores
// oficiais da doc da SocialAPI.ai assim que ela estiver em mãos.

// TODO(socialapi): confirmar base URL exata na doc.
const SOCIALAPI_BASE_URL = process.env.SOCIALAPI_BASE_URL ?? "https://api.socialapi.ai";

function apiKey(): string {
  const k = process.env.SOCIALAPI_API_KEY;
  if (!k) throw new Error("SOCIALAPI_API_KEY não configurado no servidor.");
  return k;
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${SOCIALAPI_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${apiKey()}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!res.ok) {
    const msg = (json as { error?: { message?: string }; message?: string })?.error?.message
      ?? (json as { message?: string })?.message
      ?? text
      ?? `SocialAPI erro ${res.status}`;
    throw new Error(`SocialAPI ${res.status}: ${msg}`);
  }
  return json as T;
}

export type SocialPlatform = "facebook" | "instagram";

export type SocialApiStartResponse = {
  auth_url: string;
  // SocialAPI may return its own state — we always send our own for CSRF.
};

export type SocialApiAccount = {
  account_id: string;
  platform: SocialPlatform;
  access_token: string;
  page_id?: string | null;
  page_name?: string | null;
  page_picture_url?: string | null;
  instagram_business_id?: string | null;
  instagram_username?: string | null;
  instagram_picture_url?: string | null;
  expires_at?: string | null;
  raw?: unknown;
};

// TODO(socialapi): confirmar endpoint/payload exatos.
export async function socialApiStart(input: {
  platform: SocialPlatform;
  redirect_uri: string;
  state: string;
}): Promise<SocialApiStartResponse> {
  return req<SocialApiStartResponse>("/v1/oauth/start", {
    method: "POST",
    body: JSON.stringify({
      platform: input.platform,
      redirect_uri: input.redirect_uri,
      state: input.state,
    }),
  });
}

// TODO(socialapi): confirmar endpoint/payload exatos.
export async function socialApiExchange(input: {
  code: string;
  state: string;
  redirect_uri: string;
}): Promise<SocialApiAccount> {
  return req<SocialApiAccount>("/v1/oauth/exchange", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// TODO(socialapi): confirmar endpoint exato.
export async function socialApiRevoke(account_id: string): Promise<void> {
  await req<unknown>(`/v1/accounts/${encodeURIComponent(account_id)}`, {
    method: "DELETE",
  });
}
