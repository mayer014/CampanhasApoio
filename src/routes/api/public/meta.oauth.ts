import { createFileRoute } from "@tanstack/react-router";
import { buildMetaOAuthUrl } from "@/lib/meta-oauth";

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
        try {
          const url = new URL(request.url);
          const state = url.searchParams.get("state")?.trim() ?? "";

          console.log("[META API] request received", { url: request.url });
          console.log("[META API] state", { length: state.length, prefix: state.slice(0, 8) });

          const envDiag = {
            META_APP_ID: !!process.env.META_APP_ID,
            META_BUSINESS_LOGIN_CONFIG_ID: !!process.env.META_BUSINESS_LOGIN_CONFIG_ID,
            VITE_META_BUSINESS_LOGIN_CONFIG_ID: !!process.env.VITE_META_BUSINESS_LOGIN_CONFIG_ID,
          };
          console.log("[META API] env diag", envDiag);

          if (state.length < 16 || state.length > 2048) {
            console.warn("[META API] invalid state length", state.length);
            return badRequest("Parâmetro state inválido.");
          }

          const configId =
            process.env.META_BUSINESS_LOGIN_CONFIG_ID ??
            process.env.VITE_META_BUSINESS_LOGIN_CONFIG_ID ??
            null;
          const oauthUrl = buildMetaOAuthUrl({ state, configId });
          const payload = { url: oauthUrl };

          console.log("[META API] response", { urlPrefix: oauthUrl.slice(0, 80), hasConfigId: !!configId });

          return Response.json(payload);
        } catch (error) {
          const err = error as Error;
          console.error("[META API] handler error", err);
          return Response.json(
            {
              error: err?.message ?? "Erro desconhecido",
              stack: err?.stack ?? null,
              env: {
                META_APP_ID: !!process.env.META_APP_ID,
                META_BUSINESS_LOGIN_CONFIG_ID: !!process.env.META_BUSINESS_LOGIN_CONFIG_ID,
                VITE_META_BUSINESS_LOGIN_CONFIG_ID: !!process.env.VITE_META_BUSINESS_LOGIN_CONFIG_ID,
              },
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
