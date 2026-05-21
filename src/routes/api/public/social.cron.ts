import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Endpoint chamado por pg_cron a cada 5 minutos.
 * Autenticação simples por header `apikey` (anon key do Supabase).
 */
export const Route = createFileRoute("/api/public/social/cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
        }
        const { data, error } = await supabaseAdmin.rpc("enqueue_due_social_profiles");
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "content-type": "application/json" } });
        return Response.json({ ok: true, enqueued: data ?? 0 });
      },
    },
  },
});
