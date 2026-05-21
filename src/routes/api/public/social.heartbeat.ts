import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifySocialSignature, unauthorized, badRequest, ok } from "@/lib/social-hmac.server";

const Schema = z.object({
  worker_id: z.string().min(1).max(128),
  status: z.string().max(32).optional(),
  jobs_processed: z.number().int().nonnegative().optional(),
  last_error: z.string().max(2000).optional().nullable(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const Route = createFileRoute("/api/public/social/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (!verifySocialSignature(raw, request.headers.get("x-social-signature"))) {
          return unauthorized();
        }
        let body: unknown;
        try { body = JSON.parse(raw || "{}"); } catch { return badRequest("invalid json"); }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) return badRequest(parsed.error.message);

        const { error } = await supabaseAdmin.rpc("social_worker_heartbeat", {
          _worker_id: parsed.data.worker_id,
          _status: parsed.data.status ?? "online",
          _jobs_processed: parsed.data.jobs_processed ?? 0,
          _last_error: parsed.data.last_error ?? null,
          _meta: parsed.data.meta ?? {},
        });
        if (error) return badRequest(error.message);
        return ok({ success: true });
      },
    },
  },
});
