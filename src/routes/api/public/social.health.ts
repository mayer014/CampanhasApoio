import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * GET /api/public/social/health
 * Public read-only operational status. No PII.
 */
export const Route = createFileRoute("/api/public/social/health")({
  server: {
    handlers: {
      GET: async () => {
        const nowIso = new Date().toISOString();
        const [{ count: pending }, { count: failed }, { count: running }, workersRes, profilesRes, stateRes, lastSuccessRes] = await Promise.all([
          supabaseAdmin.from("social_jobs").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabaseAdmin.from("social_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
          supabaseAdmin.from("social_jobs").select("id", { count: "exact", head: true }).eq("status", "running"),
          supabaseAdmin.from("social_workers").select("worker_id, last_seen_at, status, jobs_processed").order("last_seen_at", { ascending: false }).limit(20),
          supabaseAdmin.from("social_profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabaseAdmin.from("social_system_state").select("breaker_open, breaker_reason, breaker_reset_at").eq("id", 1).maybeSingle(),
          supabaseAdmin.from("social_profiles").select("last_success_at").order("last_success_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
        ]);

        const twoMinAgo = Date.now() - 2 * 60 * 1000;
        const workers = workersRes.data ?? [];
        const online = workers.filter(w => new Date(w.last_seen_at).getTime() > twoMinAgo).length;

        const breaker = stateRes.data ?? { breaker_open: false };
        const status = breaker.breaker_open
          ? "paused"
          : online > 0
            ? "healthy"
            : "no_workers";

        return new Response(
          JSON.stringify({
            status,
            timestamp: nowIso,
            workers_online: online,
            workers_total: workers.length,
            workers,
            jobs: { pending: pending ?? 0, running: running ?? 0, failed: failed ?? 0 },
            profiles_active: profilesRes.count ?? 0,
            last_collection_at: lastSuccessRes.data?.last_success_at ?? null,
            breaker,
          }),
          { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
