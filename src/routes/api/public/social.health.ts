import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  assertSocialRuntimeEnv,
  socialDebugResponse,
  socialEnvStatus,
} from "@/lib/social.server";
import { normalizeSupabaseUrl } from "@/integrations/supabase/url";

function maskKey(key: string | undefined): string | null {
  if (!key) return null;
  if (key.length <= 12) return `len=${key.length}`;
  return `${key.slice(0, 14)}…${key.slice(-4)} (len=${key.length})`;
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    const out: Record<string, unknown> = { name: error.name, message: error.message };
    const anyErr = error as any;
    if (anyErr.code) out.code = anyErr.code;
    if (anyErr.details) out.details = anyErr.details;
    if (anyErr.hint) out.hint = anyErr.hint;
    if (anyErr.status) out.status = anyErr.status;
    if (anyErr.cause) {
      const c = anyErr.cause;
      out.cause = c instanceof Error ? { name: c.name, message: c.message } : c;
    }
    return out;
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
            : JSON.stringify(plain).slice(0, 500),
      code: plain.code,
      details: plain.details,
      hint: plain.hint,
      status: plain.status,
    };
  }
  return { name: typeof error, message: String(error) };
}

type ProbeResult = {
  label: string;
  ok: boolean;
  ms: number;
  detail?: unknown;
  error?: unknown;
};

async function timed<T>(label: string, fn: () => Promise<T>): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const detail = await fn();
    return { label, ok: true, ms: Date.now() - start, detail };
  } catch (error) {
    return { label, ok: false, ms: Date.now() - start, error: describeError(error) };
  }
}

async function probeHttpReach(url: string): Promise<ProbeResult> {
  return timed("http_reach", async () => {
    const res = await fetch(`${url}/auth/v1/health`, { method: "GET" });
    return { status: res.status, ok: res.ok, text: (await res.text()).slice(0, 200) };
  });
}

async function probeRestApikeyOnly(url: string, key: string): Promise<ProbeResult> {
  return timed("rest_apikey_only", async () => {
    const res = await fetch(`${url}/rest/v1/social_profiles?select=id&limit=1`, {
      headers: { apikey: key, Accept: "application/json" },
    });
    return {
      status: res.status,
      ok: res.ok,
      body_preview: (await res.text()).slice(0, 300),
    };
  });
}

async function probeRestApikeyPlusBearer(url: string, key: string): Promise<ProbeResult> {
  return timed("rest_apikey_plus_bearer", async () => {
    const res = await fetch(`${url}/rest/v1/social_profiles?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
    });
    return {
      status: res.status,
      ok: res.ok,
      body_preview: (await res.text()).slice(0, 300),
    };
  });
}

async function probeAdminSelect(): Promise<ProbeResult> {
  return timed("admin_select_social_profiles", async () => {
    const { data, error, status } = await supabaseAdmin
      .from("social_profiles")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return { status, count: (data as any)?.length ?? null };
  });
}

async function probeAdminRpc(): Promise<ProbeResult> {
  return timed("admin_rpc_social_dashboard_stats", async () => {
    const { data, error } = await supabaseAdmin.rpc("social_dashboard_stats");
    if (error) throw error;
    return { has_data: !!data };
  });
}

async function probeAdminWorkers(): Promise<ProbeResult> {
  return timed("admin_select_social_workers", async () => {
    const { data, error } = await supabaseAdmin
      .from("social_workers")
      .select("worker_id, last_seen_at")
      .limit(5);
    if (error) throw error;
    return { rows: data?.length ?? 0 };
  });
}

/**
 * GET /api/public/social/health
 * Detailed layered diagnostic — pinpoints the failing layer.
 */
export const Route = createFileRoute("/api/public/social/health")({
  server: {
    handlers: {
      GET: async () => {
        const nowIso = new Date().toISOString();
        try {
          assertSocialRuntimeEnv("social.health.env", [
            "SUPABASE_URL",
            "SUPABASE_SERVICE_ROLE_KEY",
          ]);

          const url =
            normalizeSupabaseUrl(process.env.SUPABASE_URL) ||
            normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL) ||
            normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL) ||
            "https://pfppmkqsdqawvykkgafe.supabase.co";
          const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

          const probes: ProbeResult[] = [];
          probes.push(await probeHttpReach(url));
          probes.push(await probeRestApikeyOnly(url, key));
          probes.push(await probeRestApikeyPlusBearer(url, key));
          probes.push(await probeAdminSelect());
          probes.push(await probeAdminWorkers());
          probes.push(await probeAdminRpc());

          const allOk = probes.every((p) => p.ok);

          return new Response(
            JSON.stringify(
              {
                status: allOk ? "healthy" : "degraded",
                timestamp: nowIso,
                runtime_env: socialEnvStatus(),
                key_fingerprint: maskKey(key),
                supabase_url: url,
                probes,
              },
              null,
              2,
            ),
            {
              status: allOk ? 200 : 503,
              headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
            },
          );
        } catch (error) {
          return socialDebugResponse("social.health", error);
        }
      },
    },
  },
});
