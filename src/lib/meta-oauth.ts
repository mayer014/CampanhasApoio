export const META_APP_ID = "1752081939539800";
export const META_REDIRECT_URI = "https://fotodeapoio.easychain.com.br/auth/meta/callback";
export const META_SCOPES = [
  "public_profile",
  "email",
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_manage_comments",
  "instagram_manage_insights",
];

export function buildMetaOAuthUrl(state?: string) {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_REDIRECT_URI,
    response_type: "token",
    scope: META_SCOPES.join(","),
    display: "popup",
    auth_type: "rerequest",
  });
  if (state) params.set("state", state);
  return `https://www.facebook.com/v23.0/dialog/oauth?${params.toString()}`;
}
