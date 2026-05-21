import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/social/health")({
  server: {
    handlers: {
      GET: async () => {
        const probes: Record<string, { ok: boolean; ms: number; error?: string }> = {};

        const start = Date.now();
        try {
          const { error } = await supabaseAdmin
            .from("social_profiles")
            .select("id", { count: "exact", head: true });
          probes.select = { ok: !error, ms: Date.now() - start, error: error?.message };
        } catch (e) {
          probes.select = { ok: false, ms: Date.now() - start, error: (e as Error).message };
        }

        const s2 = Date.now();
        try {
          const { error } = await supabaseAdmin.rpc("social_dashboard_stats");
          probes.rpc = { ok: !error, ms: Date.now() - s2, error: error?.message };
        } catch (e) {
          probes.rpc = { ok: false, ms: Date.now() - s2, error: (e as Error).message };
        }

        const healthy = Object.values(probes).every((p) => p.ok);
        return new Response(
          JSON.stringify({
            status: healthy ? "healthy" : "degraded",
            timestamp: new Date().toISOString(),
            probes,
            env: {
              hasSupabaseUrl: !!process.env.SUPABASE_URL,
              hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
              hasHmacSecret: !!process.env.SOCIAL_HMAC_SECRET,
            },
          }),
          {
            status: healthy ? 200 : 503,
            headers: { "content-type": "application/json" },
          },
        );
      },
    },
  },
});
