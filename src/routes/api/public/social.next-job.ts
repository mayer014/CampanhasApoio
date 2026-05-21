import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifySocialHmac } from "@/lib/social-hmac.server";

export const Route = createFileRoute("/api/public/social/next-job")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const v = verifySocialHmac(
          raw,
          request.headers.get("x-social-signature"),
          request.headers.get("x-social-timestamp"),
        );
        if (!v.ok) return new Response(JSON.stringify({ error: "unauthorized", reason: v.reason }), { status: 401, headers: { "content-type": "application/json" } });

        const workerId = request.headers.get("x-worker-id") || "unknown";

        const { data, error } = await supabaseAdmin.rpc("claim_next_social_job", { _worker_id: workerId });
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "content-type": "application/json" } });

        const job = Array.isArray(data) && data.length ? data[0] : null;
        if (!job) return Response.json({ job: null, profile: null });

        let profile = null;
        if (job.profile_id) {
          const { data: p } = await supabaseAdmin
            .from("social_profiles")
            .select("id, username, platform, profile_type, last_checked_at, followers_count")
            .eq("id", job.profile_id)
            .maybeSingle();
          profile = p;
        }
        return Response.json({ job, profile });
      },
    },
  },
});
