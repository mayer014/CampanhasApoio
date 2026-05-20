import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifySocialHmac } from "@/lib/social.server";

/**
 * POST /api/public/social/next-job
 * Body: {} (raw "{}" included in HMAC)
 * Headers: X-Social-Signature, X-Social-Timestamp, X-Worker-Id
 *
 * Returns next pending job (claim via FOR UPDATE SKIP LOCKED) or {job: null}.
 */
export const Route = createFileRoute("/api/public/social/next-job")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-social-signature");
        const ts = request.headers.get("x-social-timestamp");
        const workerId = request.headers.get("x-worker-id") || "unknown";

        const v = verifySocialHmac(raw, sig, ts);
        if (!v.ok) {
          return new Response(JSON.stringify({ error: v.reason }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { data, error } = await supabaseAdmin.rpc("claim_next_social_job", {
          _worker_id: workerId,
        });
        if (error) {
          console.error("[social.next-job]", error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const job = Array.isArray(data) && data.length > 0 ? data[0] : null;
        if (!job) {
          return new Response(JSON.stringify({ job: null }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Hydrate with profile data
        let profile: any = null;
        if (job.profile_id) {
          const { data: p } = await supabaseAdmin
            .from("social_profiles")
            .select(
              "id, username, platform, profile_type, last_checked_at, followers_count",
            )
            .eq("id", job.profile_id)
            .maybeSingle();
          profile = p;
        }

        return new Response(JSON.stringify({ job, profile }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
