import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Cron tick: enqueue due social profiles (called by pg_cron every ~5min).
 * Public endpoint protected via standard apikey header (Supabase anon key).
 */
export const Route = createFileRoute("/api/public/social/cron")({
  server: {
    handlers: {
      POST: async () => {
        const { data, error } = await supabaseAdmin.rpc("enqueue_due_social_profiles");
        if (error) {
          console.error("[social.cron]", error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
        return new Response(JSON.stringify({ enqueued: data ?? 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => {
        const { data, error } = await supabaseAdmin.rpc("enqueue_due_social_profiles");
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        return new Response(JSON.stringify({ enqueued: data ?? 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
