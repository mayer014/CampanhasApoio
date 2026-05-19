import { createFileRoute } from "@tanstack/react-router";
import { tickBroadcastsInternal } from "@/lib/whatsapp.server";

/** Called by pg_cron every 30s. Processes one recipient per running broadcast. */
export const Route = createFileRoute("/api/public/whatsapp/broadcast-tick")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const res = await tickBroadcastsInternal();
          return new Response(JSON.stringify(res), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("[wa tick] error", e);
          return new Response(
            JSON.stringify({ error: e?.message || "tick failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
      GET: async () => {
        const res = await tickBroadcastsInternal();
        return new Response(JSON.stringify(res), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
