import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifySocialHmac } from "@/lib/social-hmac.server";

const Body = z.object({
  level: z.enum(["debug", "info", "warn", "error", "critical"]),
  kind: z.string().min(1).max(40),
  message: z.string().max(2000),
  profile_id: z.string().uuid().nullable().optional(),
  job_id: z.string().uuid().nullable().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

type DbKind = "other" | "login_wall" | "rate_limit" | "captcha" | "network" | "parse" | "success";
function mapKind(k: string): DbKind {
  switch (k) {
    case "login_wall": return "login_wall";
    case "rate_limit": return "rate_limit";
    case "captcha": return "captcha";
    case "network_error":
    case "network": return "network";
    case "parse":
    case "parser_failure": return "parse";
    case "success": return "success";
    default: return "other";
  }
}

export const Route = createFileRoute("/api/public/social/log")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const v = verifySocialHmac(raw, request.headers.get("x-social-signature"), request.headers.get("x-social-timestamp"));
        if (!v.ok) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
        const workerId = request.headers.get("x-worker-id") || "unknown";

        let body;
        try { body = Body.parse(JSON.parse(raw)); }
        catch (e) { return new Response(JSON.stringify({ error: "bad_request", detail: (e as Error).message }), { status: 400, headers: { "content-type": "application/json" } }); }

        await supabaseAdmin.from("social_worker_logs").insert({
          worker_id: workerId,
          level: body.level,
          kind: mapKind(body.kind),
          message: body.message,
          profile_id: body.profile_id ?? null,
          job_id: body.job_id ?? null,
          context: (body.context ?? {}) as never,
        });
        return Response.json({ ok: true });
      },
    },
  },
});
