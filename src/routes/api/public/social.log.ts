import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifySocialHmac } from "@/lib/social.server";

const VALID_KINDS = new Set([
  "login_wall", "rate_limit", "timeout", "parser_failure",
  "ingest_failure", "network_error", "captcha", "breaker", "other",
]);
const VALID_LEVELS = new Set(["debug", "info", "warn", "error", "critical"]);

/**
 * POST /api/public/social/log
 * Body: { level, kind, message, profile_id?, job_id?, context? }
 * Auto-evaluates circuit breaker after each log.
 */
export const Route = createFileRoute("/api/public/social/log")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-social-signature");
        const ts = request.headers.get("x-social-timestamp");
        const workerId = request.headers.get("x-worker-id") || "unknown";

        const v = verifySocialHmac(raw, sig, ts);
        if (!v.ok) return new Response(JSON.stringify({ error: v.reason }), { status: 401 });

        let body: any;
        try { body = JSON.parse(raw); } catch {
          return new Response(JSON.stringify({ error: "bad json" }), { status: 400 });
        }

        const level = VALID_LEVELS.has(body.level) ? body.level : "info";
        const kind = VALID_KINDS.has(body.kind) ? body.kind : "other";
        const message = String(body.message || "").slice(0, 1000);
        if (!message) {
          return new Response(JSON.stringify({ error: "missing message" }), { status: 400 });
        }

        await supabaseAdmin.from("social_worker_logs").insert({
          worker_id: workerId,
          profile_id: body.profile_id ?? null,
          job_id: body.job_id ?? null,
          level,
          kind,
          message,
          context: body.context && typeof body.context === "object" ? body.context : {},
        });

        // Auto evaluate breaker only for critical kinds
        if (["login_wall", "rate_limit", "captcha"].includes(kind)) {
          await supabaseAdmin.rpc("social_evaluate_breaker");
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
