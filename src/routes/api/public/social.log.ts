import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifySocialSignature, unauthorized, badRequest, ok } from "@/lib/social-hmac.server";

const Schema = z.object({
  worker_id: z.string().min(1).max(128).optional().nullable(),
  job_id: z.string().uuid().optional().nullable(),
  profile_id: z.string().uuid().optional().nullable(),
  level: z.enum(["debug", "info", "warn", "error", "critical"]).default("info"),
  kind: z.enum(["other", "login_wall", "rate_limit", "captcha", "network", "parse", "success"]).default("other"),
  message: z.string().min(1).max(4000),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const Route = createFileRoute("/api/public/social/log")({
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

        const { error } = await supabaseAdmin.from("social_worker_logs").insert({
          worker_id: parsed.data.worker_id ?? null,
          job_id: parsed.data.job_id ?? null,
          profile_id: parsed.data.profile_id ?? null,
          level: parsed.data.level,
          kind: parsed.data.kind,
          message: parsed.data.message,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          context: (parsed.data.context ?? {}) as any,
        });
        if (error) return badRequest(error.message);
        return ok({ success: true });
      },
    },
  },
});
