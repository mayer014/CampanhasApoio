export const META_APP_ID = "2042324250036581";
export const META_REDIRECT_URI = "https://fotodeapoio.easychain.com.br/auth/meta/callback";
export const META_GRAPH_VERSION = "v23.0";
export const META_OAUTH_STATE_STORAGE_KEY = "meta_oauth_state";
export const META_BUSINESS_LOGIN_CONFIG_ID =
  (import.meta.env?.VITE_META_BUSINESS_LOGIN_CONFIG_ID as string | undefined) ?? null;
export const META_REDIRECT_ORIGIN = new URL(META_REDIRECT_URI).origin;

export const META_SCOPES = [
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "pages_read_user_content",
  "pages_manage_engagement",
  "instagram_basic",
  "instagram_manage_comments",
  "instagram_manage_insights",
];

export function generateMetaOAuthState() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function createMetaOAuthState(origin: string) {
  if (!origin) throw new Error("Origin é obrigatória para iniciar o OAuth da Meta.");
  return encodeBase64Url(JSON.stringify({ nonce: generateMetaOAuthState(), origin }));
}

export function parseMetaOAuthState(state: string): { nonce: string; origin: string } | null {
  try {
    const parsed = JSON.parse(decodeBase64Url(state)) as { nonce?: string; origin?: string };
    if (!parsed?.nonce || !parsed?.origin) return null;
    const origin = new URL(parsed.origin).origin;
    if (parsed.nonce.length < 32) return null;
    return { nonce: parsed.nonce, origin };
  } catch {
    return null;
  }
}

type BuildMetaOAuthUrlOptions = {
  state: string;
  configId?: string | null;
};

export function buildMetaOAuthUrl({ state, configId }: BuildMetaOAuthUrlOptions) {
  if (!state) throw new Error("OAuth state é obrigatório.");
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_REDIRECT_URI,
    response_type: "code",
    scope: META_SCOPES.join(","),
    state,
    display: "popup",
    auth_type: "rerequest",
  });
  const finalConfigId = configId ?? META_BUSINESS_LOGIN_CONFIG_ID;
  if (finalConfigId) params.set("config_id", finalConfigId);
  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}
