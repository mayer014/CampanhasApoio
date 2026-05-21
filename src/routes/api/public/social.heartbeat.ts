import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifySocialHmac } from "@/lib/social-hmac.server";

const Body = z.object({
  status: z.enum(["online", "idle", "degraded", "offline"]).optional(),
  jobs_processed: z.number().int().optional(),
  last_error: z.string().max(500).nullable().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const Route = createFileRoute("/api/public/social/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const v = verifySocialHmac(raw, request.headers.get("x-social-signature"), request.headers.get("x-social-timestamp"));
        if (!v.ok) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });

        const workerId = request.headers.get("x-worker-id") || "unknown";
        const body = Body.parse(JSON.parse(raw || "{}"));

        await supabaseAdmin.rpc("social_worker_heartbeat", {
          _worker_id: workerId,
          _status: body.status ?? "online",
          _jobs_processed: body.jobs_processed ?? 0,
          _last_error: body.last_error ?? null,
          _meta: body.meta ?? {},
        });

        const { data: state } = await supabaseAdmin
          .from("social_system_state")
          .select("breaker_open, breaker_reason, breaker_reset_at")
          .eq("id", 1)
          .maybeSingle();

        return Response.json({ ok: true, breaker: state ?? { breaker_open: false } });
      },
    },
  },
});
