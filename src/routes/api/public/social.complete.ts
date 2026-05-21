import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifySocialSignature, unauthorized, badRequest, ok } from "@/lib/social-hmac.server";

const Schema = z.object({
  job_id: z.string().uuid(),
  ok: z.boolean(),
  error: z.string().max(2000).optional().nullable(),
});

export const Route = createFileRoute("/api/public/social/complete")({
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

        const { error } = await supabaseAdmin.rpc("complete_social_job", {
          _job_id: parsed.data.job_id,
          _ok: parsed.data.ok,
          _error: parsed.data.error ?? null,
        });
        if (error) return badRequest(error.message);
        return ok({ success: true });
      },
    },
  },
});
