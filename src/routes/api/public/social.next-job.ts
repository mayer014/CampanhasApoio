import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifySocialSignature, unauthorized, badRequest, ok } from "@/lib/social-hmac.server";

const Schema = z.object({
  worker_id: z.string().min(1).max(128),
});

export const Route = createFileRoute("/api/public/social/next-job")({
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

        const { data, error } = await supabaseAdmin.rpc("claim_next_social_job", {
          _worker_id: parsed.data.worker_id,
        });
        if (error) return badRequest(error.message);
        const job = Array.isArray(data) && data.length > 0 ? data[0] : null;
        return ok({ job });
      },
    },
  },
});
