export const META_APP_ID = "2042324250036581";
export const META_REDIRECT_URI = "https://fotodeapoio.easychain.com.br/auth/meta/callback";
export const META_GRAPH_VERSION = "v23.0";
export const META_OAUTH_STATE_STORAGE_KEY = "meta_oauth_state";
export const META_BUSINESS_LOGIN_CONFIG_ID =
  (import.meta.env?.VITE_META_BUSINESS_LOGIN_CONFIG_ID as string | undefined) ?? null;

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
