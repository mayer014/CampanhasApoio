import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertSocialRuntimeEnv, socialDebugResponse } from "@/lib/social.server";

/**
 * Cron tick: enqueue due social profiles (called by pg_cron every ~5min).
 * Public endpoint protected via standard apikey header (Supabase anon key).
 */
export const Route = createFileRoute("/api/public/social/cron")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const env = assertSocialRuntimeEnv("social.cron.post.env", [
            "SUPABASE_URL",
            "SUPABASE_SERVICE_ROLE_KEY",
          ]);
          const { data, error } = await supabaseAdmin.rpc("enqueue_due_social_profiles");
          if (error) throw error;
          return new Response(JSON.stringify({ enqueued: data ?? 0 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          return socialDebugResponse("social.cron.enqueue_due_social_profiles.POST", error);
        }
      },
      GET: async () => {
        try {
          const env = assertSocialRuntimeEnv("social.cron.get.env", [
            "SUPABASE_URL",
            "SUPABASE_SERVICE_ROLE_KEY",
          ]);
          const { data, error } = await supabaseAdmin.rpc("enqueue_due_social_profiles");
          if (error) throw error;
          return new Response(JSON.stringify({ enqueued: data ?? 0 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          return socialDebugResponse("social.cron.enqueue_due_social_profiles.GET", error);
        }
      },
    },
  },
});
