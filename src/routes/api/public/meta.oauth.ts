import { createFileRoute } from "@tanstack/react-router";
import { buildMetaOAuthUrl, META_APP_ID, META_REDIRECT_URI } from "@/lib/meta-oauth";

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/meta/oauth")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const state = url.searchParams.get("state")?.trim() ?? "";

        if (state.length < 16 || state.length > 2048) {
          return badRequest("Parâmetro state inválido.");
        }

        const configId = process.env.META_BUSINESS_LOGIN_CONFIG_ID ?? null;
        const oauthUrl = buildMetaOAuthUrl({ state, configId });

        return Response.json({
          url: oauthUrl,
          state,
          client_id: META_APP_ID,
          redirect_uri: META_REDIRECT_URI,
          config_id: configId,
        });
      },
    },
  },
});