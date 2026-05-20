import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifySocialHmac } from "@/lib/social.server";

/**
 * POST /api/public/social/heartbeat
 * Body: { status?: "online"|"idle"|"degraded"|"offline", jobs_processed?: number, last_error?: string, meta?: object }
 */
export const Route = createFileRoute("/api/public/social/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-social-signature");
        const ts = request.headers.get("x-social-timestamp");
        const workerId = request.headers.get("x-worker-id") || "unknown";

        const v = verifySocialHmac(raw, sig, ts);
        if (!v.ok) return new Response(JSON.stringify({ error: v.reason }), { status: 401 });

        let body: any = {};
        try { body = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }

        const { error } = await supabaseAdmin.rpc("social_worker_heartbeat", {
          _worker_id: workerId,
          _status: typeof body.status === "string" ? body.status : "online",
          _jobs_processed: Number.isFinite(body.jobs_processed) ? body.jobs_processed : 0,
          _last_error: body.last_error ? String(body.last_error).slice(0, 500) : "",
          _meta: body.meta && typeof body.meta === "object" ? body.meta : {},
        });
        if (error) {
          console.error("[social.heartbeat]", error.message);
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        // Read breaker state so worker can throttle locally
        const { data: state } = await supabaseAdmin
          .from("social_system_state")
          .select("breaker_open, breaker_reason, breaker_reset_at")
          .eq("id", 1)
          .maybeSingle();

        return new Response(
          JSON.stringify({ ok: true, breaker: state ?? { breaker_open: false } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
