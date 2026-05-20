import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertSocialRuntimeEnv, socialDebugResponse, socialEnvStatus } from "@/lib/social.server";

async function runRawSupabaseRestProbe() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return {
      ok: false,
      skipped: true,
      reason: "missing env",
    };
  }

  try {
    const response = await fetch(`${url}/rest/v1/social_jobs?select=id&limit=1`, {
      headers: {
        apikey: key,
      },
    });

    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      body_preview: text.slice(0, 300),
    };
  } catch (error) {
    return {
      ok: false,
      error: formatHealthError(error),
    };
  }
}

function formatHealthError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  if (error && typeof error === "object") {
    const plain = error as Record<string, unknown>;
    return {
      name: typeof plain.name === "string" ? plain.name : "unknown",
      message:
        typeof plain.message === "string"
          ? plain.message
          : typeof plain.error === "string"
            ? plain.error
            : JSON.stringify(plain),
      code: typeof plain.code === "string" ? plain.code : undefined,
      details: typeof plain.details === "string" ? plain.details : undefined,
      hint: typeof plain.hint === "string" ? plain.hint : undefined,
    };
  }

  return {
    name: typeof error,
    message: String(error),
  };
}

type HealthCheckSuccess<T> = {
  ok: true;
  label: string;
  data: T;
  count: number | null;
};

type HealthCheckFailure = {
  ok: false;
  label: string;
  error: ReturnType<typeof formatHealthError>;
};

type HealthCheckResult<T> = HealthCheckSuccess<T> | HealthCheckFailure;

/**
 * GET /api/public/social/health
 * Public read-only operational status. No PII.
 */
export const Route = createFileRoute("/api/public/social/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          assertSocialRuntimeEnv("social.health.env", [
            "SUPABASE_URL",
            "SUPABASE_SERVICE_ROLE_KEY",
          ]);
          const nowIso = new Date().toISOString();
          const check = async <T,>(
            label: string,
            run: () => PromiseLike<{ data: T; error: unknown; count?: number | null }>,
          ): Promise<HealthCheckResult<T>> => {
            try {
              const result = await run();
              if (result.error) {
                return {
                  ok: false as const,
                  label,
                  error: formatHealthError(result.error),
                };
              }

              return {
                ok: true as const,
                label,
                data: result.data,
                count: result.count ?? null,
              };
            } catch (error) {
              return {
                ok: false as const,
                label,
                error: formatHealthError(error),
              };
            }
          };

          const [pendingRes, failedRes, runningRes, workersRes, profilesRes, stateRes, lastSuccessRes] = await Promise.all([
            check("jobs_pending", () => supabaseAdmin.from("social_jobs").select("id", { count: "exact", head: true }).eq("status", "pending")),
            check("jobs_failed", () => supabaseAdmin.from("social_jobs").select("id", { count: "exact", head: true }).eq("status", "failed")),
            check("jobs_running", () => supabaseAdmin.from("social_jobs").select("id", { count: "exact", head: true }).eq("status", "running")),
            check("workers", () => supabaseAdmin.from("social_workers").select("worker_id, last_seen_at, status, jobs_processed").order("last_seen_at", { ascending: false }).limit(20)),
            check("profiles_active", () => supabaseAdmin.from("social_profiles").select("id", { count: "exact", head: true }).eq("is_active", true)),
            check("system_state", () => supabaseAdmin.from("social_system_state").select("breaker_open, breaker_reason, breaker_reset_at").eq("id", 1).maybeSingle()),
            check("last_success", () => supabaseAdmin.from("social_profiles").select("last_success_at").order("last_success_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle()),
          ]);

          if (!pendingRes.ok || !failedRes.ok || !runningRes.ok || !workersRes.ok || !profilesRes.ok || !stateRes.ok || !lastSuccessRes.ok) {
            const failures: HealthCheckFailure[] = [pendingRes, failedRes, runningRes, workersRes, profilesRes, stateRes, lastSuccessRes].filter(
              (item): item is HealthCheckFailure => !item.ok,
            );
            const raw_probe = await runRawSupabaseRestProbe();

            return new Response(
              JSON.stringify({
                status: "degraded",
                timestamp: nowIso,
                runtime_env: socialEnvStatus(),
                raw_probe,
                failed_checks: failures,
              }),
              { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
            );
          }

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
              jobs: {
                pending: pendingRes.count ?? 0,
                running: runningRes.count ?? 0,
                failed: failedRes.count ?? 0,
              },
              profiles_active: profilesRes.count ?? 0,
              last_collection_at: lastSuccessRes.data?.last_success_at ?? null,
              breaker,
              runtime_env: socialEnvStatus(),
              crypto_runtime: "node:crypto",
            }),
            { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
          );
        } catch (error) {
          return socialDebugResponse("social.health", error);
        }
      },
    },
  },
});
