import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/social/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { error } = await supabaseAdmin.from("social_profiles").select("id", { count: "exact", head: true });
          if (error) throw error;
          return Response.json({ status: "healthy", ts: new Date().toISOString() });
        } catch (e) {
          return new Response(JSON.stringify({ status: "degraded", error: (e as Error).message }), { status: 500, headers: { "content-type": "application/json" } });
        }
      },
    },
  },
});
