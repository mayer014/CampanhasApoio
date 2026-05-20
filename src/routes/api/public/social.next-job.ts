import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  assertSocialRuntimeEnv,
  socialDebugResponse,
  socialHmacHeaderDebug,
  verifySocialHmac,
} from "@/lib/social.server";

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
        const headerDebug = socialHmacHeaderDebug(sig, ts, workerId);

        try {
          const env = assertSocialRuntimeEnv("social.next-job.env", [
            "SUPABASE_URL",
            "SUPABASE_SERVICE_ROLE_KEY",
            "SOCIAL_HMAC_SECRET",
          ]);
          const v = verifySocialHmac(raw, sig, ts);
          if (!v.ok) {
            return new Response(JSON.stringify({ error: v.reason, location: "social.next-job.hmac" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { data, error } = await supabaseAdmin.rpc("claim_next_social_job", {
            _worker_id: workerId,
          });
          if (error) throw error;

          const job = Array.isArray(data) && data.length > 0 ? data[0] : null;
          if (!job) {
            return new Response(JSON.stringify({ job: null }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          let profile: any = null;
          if (job.profile_id) {
            const { data: p, error: profileErr } = await supabaseAdmin
              .from("social_profiles")
              .select(
                "id, username, platform, profile_type, last_checked_at, followers_count",
              )
              .eq("id", job.profile_id)
              .maybeSingle();
            if (profileErr) throw profileErr;
            profile = p;
          }

          return new Response(JSON.stringify({ job, profile }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          return socialDebugResponse("social.next-job.claim_next_social_job", error, {
            ...headerDebug,
            raw_body_length: raw.length,
            worker_id: workerId,
          });
        }
      },
    },
  },
});
