// Server-only helpers for Social Intelligence Engine (Fase 1).
// NEVER import from client code.
import { createHmac, timingSafeEqual } from "crypto";
import { normalizeSupabaseUrl } from "@/integrations/supabase/url";

type SocialDebugExtra = Record<string, unknown>;

const FALLBACK_SUPABASE_URL = "https://pfppmkqsdqawvykkgafe.supabase.co";

function isDevRuntime() {
  return process.env.NODE_ENV !== "production";
}

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(value, (_key, currentValue) => {
      if (currentValue instanceof Error) {
        return {
          name: currentValue.name,
          message: currentValue.message,
          stack: currentValue.stack,
        };
      }

      if (typeof currentValue === "bigint") {
        return String(currentValue);
      }

      if (typeof currentValue === "object" && currentValue !== null) {
        if (seen.has(currentValue)) {
          return "[Circular]";
        }
        seen.add(currentValue);
      }

      return currentValue;
    });
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function simplifyError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause:
        error.cause instanceof Error
          ? {
              name: error.cause.name,
              message: error.cause.message,
              stack: error.cause.stack,
            }
          : error.cause,
    };
  }

  if (error && typeof error === "object") {
    const plain = error as Record<string, unknown>;
    return {
      name:
        typeof plain.name === "string"
          ? plain.name
          : typeof plain.code === "string"
            ? plain.code
            : "object",
      message:
        typeof plain.message === "string"
          ? plain.message
          : typeof plain.error === "string"
            ? plain.error
            : safeStringify(error),
      stack: typeof plain.stack === "string" ? plain.stack : undefined,
      cause: undefined,
    };
  }

  return {
    name: typeof error,
    message: typeof error === "string" ? error : safeStringify(error),
    stack: undefined,
    cause: undefined,
  };
}

function sanitizeExtras(extra?: SocialDebugExtra): SocialDebugExtra | undefined {
  if (!extra) return undefined;

  try {
    return JSON.parse(
      safeStringify(extra),
    ) as SocialDebugExtra;
  } catch {
    return {
      serialization_error: "Failed to sanitize debug extras",
    } as SocialDebugExtra;
  }
}

function getResolvedSupabaseUrl() {
  const processUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const processViteUrl = normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL);
  const importMetaViteUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);

  if (processUrl) {
    return { value: processUrl, source: "process.env.SUPABASE_URL" };
  }
  if (processViteUrl) {
    return { value: processViteUrl, source: "process.env.VITE_SUPABASE_URL" };
  }
  if (importMetaViteUrl) {
    return { value: importMetaViteUrl, source: "import.meta.env.VITE_SUPABASE_URL" };
  }
  return { value: FALLBACK_SUPABASE_URL, source: "fallback.constant" };
}

function getRuntimeHints() {
  return {
    hasProcess: typeof process !== "undefined",
    nodeEnv: process.env.NODE_ENV || "unknown",
    nodeVersion: process.versions?.node ?? null,
    hasWebSocketPair: "WebSocketPair" in globalThis,
    hasCaches: typeof caches !== "undefined",
  };
}

export function socialEnvStatus() {
  const supabaseUrl = getResolvedSupabaseUrl();
  return {
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasProcessViteSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
    hasImportMetaViteSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
    hasResolvedSupabaseUrl: !!supabaseUrl.value,
    resolvedSupabaseUrlSource: supabaseUrl.source,
    hasSupabaseServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasSocialHmacSecret: !!process.env.SOCIAL_HMAC_SECRET,
    nodeEnv: process.env.NODE_ENV || "unknown",
    runtime: getRuntimeHints(),
  };
}

export function assertSocialRuntimeEnv(
  location: string,
  required: Array<"SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY" | "SOCIAL_HMAC_SECRET"> = [],
) {
  const env = socialEnvStatus();
  console.log("[social.debug] ENV CHECK", {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    PROCESS_VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
    IMPORT_META_VITE_SUPABASE_URL: !!import.meta.env.VITE_SUPABASE_URL,
    resolvedSupabaseUrlSource: env.resolvedSupabaseUrlSource,
    runtime: env.runtime,
  });
  const missing = required.filter((key) => {
    if (key === "SUPABASE_URL") return !env.hasResolvedSupabaseUrl;
    if (key === "SUPABASE_SERVICE_ROLE_KEY") return !env.hasSupabaseServiceRoleKey;
    return !env.hasSocialHmacSecret;
  });
  if (missing.length > 0) {
    const error = new Error(`Missing runtime env(s): ${missing.join(", ")}`);
    logSocialError(location, error, { env });
    throw error;
  }
  return env;
}

export function logSocialError(location: string, error: unknown, extra?: SocialDebugExtra) {
  console.error(`[social.debug] ${location}`, {
    location,
    ...simplifyError(error),
    ...sanitizeExtras(extra),
  });
}

export function socialDebugPayload(location: string, error: unknown, extra?: SocialDebugExtra) {
  const simplified = simplifyError(error);
  return {
    error: simplified.message,
    stack: simplified.stack,
    cause: simplified.cause,
    location,
    ...(sanitizeExtras(extra) ?? {}),
  };
}

export function throwSocialDebugError(location: string, error: unknown, extra?: SocialDebugExtra): never {
  logSocialError(location, error, extra);
  const payload = socialDebugPayload(location, error, extra);
  throw new Error(isDevRuntime() ? JSON.stringify(payload) : payload.error);
}

export function socialDebugResponse(
  location: string,
  error: unknown,
  extra?: SocialDebugExtra,
  status = 500,
) {
  logSocialError(location, error, extra);
  const payload = socialDebugPayload(location, error, extra);
  return new Response(
    JSON.stringify(isDevRuntime() ? payload : { error: payload.error, location }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

export function socialHmacHeaderDebug(
  signatureHeader: string | null,
  timestampHeader: string | null,
  workerId?: string | null,
) {
  return {
    hmac: {
      signature_present: !!signatureHeader,
      signature_length: signatureHeader?.length ?? 0,
      timestamp_present: !!timestampHeader,
      timestamp: timestampHeader,
      worker_id: workerId ?? null,
    },
  };
}

export function socialHmacSecret(): string {
  const s = process.env.SOCIAL_HMAC_SECRET;
  if (!s) {
    const error = new Error("SOCIAL_HMAC_SECRET not configured");
    logSocialError("socialHmacSecret", error, { env: socialEnvStatus() });
    throw error;
  }
  return s;
}

/**
 * Verify HMAC-SHA256 signature.
 * Crawler sends: X-Social-Signature: sha256=<hex>  computed over raw body + "." + timestamp.
 * X-Social-Timestamp: unix seconds (rejected if > 5min skew).
 */
export function verifySocialHmac(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
): { ok: true } | { ok: false; reason: string } {
  const headerDebug = socialHmacHeaderDebug(signatureHeader, timestampHeader);
  if (!signatureHeader || !timestampHeader) {
    logSocialError("verifySocialHmac.missing_headers", new Error("missing signature/timestamp"), headerDebug);
    return { ok: false, reason: "missing signature/timestamp" };
  }
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) {
    logSocialError("verifySocialHmac.bad_timestamp", new Error("bad timestamp"), headerDebug);
    return { ok: false, reason: "bad timestamp" };
  }
  const skew = Math.abs(Date.now() / 1000 - ts);
  try {
    if (skew > 300) {
      logSocialError("verifySocialHmac.timestamp_skew", new Error("timestamp skew"), {
        ...headerDebug,
        skew_seconds: skew,
      });
      return { ok: false, reason: "timestamp skew" };
    }

    const expected = createHmac("sha256", socialHmacSecret())
      .update(`${rawBody}.${ts}`)
      .digest("hex");
    const received = signatureHeader.replace(/^sha256=/, "").trim();
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(received, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      logSocialError("verifySocialHmac.bad_signature", new Error("bad signature"), {
        ...headerDebug,
        skew_seconds: skew,
      });
      return { ok: false, reason: "bad signature" };
    }
  } catch (error) {
    logSocialError("verifySocialHmac.crypto", error, {
      ...headerDebug,
      raw_body_length: rawBody.length,
      crypto_runtime: "node:crypto",
    });
    return { ok: false, reason: "bad signature encoding" };
  }
  return { ok: true };
}

/** Detect viral_post / competitor_growth heuristics after ingest. */
export async function detectAlertsForProfile(
  admin: any,
  profileId: string,
  candidateId: string,
  profileType: string,
): Promise<void> {
  // Pull last 2 snapshots per post (last 24h) — minimal cost.
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: posts } = await admin
    .from("social_posts")
    .select("id, posted_at, caption")
    .eq("profile_id", profileId)
    .gte("posted_at", sinceIso)
    .order("posted_at", { ascending: false })
    .limit(30);

  if (!posts || posts.length === 0) return;

  for (const p of posts) {
    const { data: snaps } = await admin
      .from("social_post_snapshots")
      .select("captured_at, likes, comments")
      .eq("post_id", p.id)
      .order("captured_at", { ascending: false })
      .limit(2);

    if (!snaps || snaps.length < 2) continue;
    const [cur, prev] = snaps;
    const curEng = (cur.likes || 0) + (cur.comments || 0) * 3;
    const prevEng = (prev.likes || 0) + (prev.comments || 0) * 3;
    if (prevEng < 50) continue;
    const growth = curEng / Math.max(prevEng, 1);
    const dtMin = Math.max(
      (new Date(cur.captured_at).getTime() - new Date(prev.captured_at).getTime()) / 60000,
      1,
    );
    const perHour = ((curEng - prevEng) / dtMin) * 60;

    if (growth >= 3 && perHour >= 200) {
      // Idempotência simples: não cria se já existe alerta viral_post nas últimas 12h
      const { data: existing } = await admin
        .from("social_alerts")
        .select("id")
        .eq("post_id", p.id)
        .eq("alert_type", "viral_post")
        .gte("created_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
        .maybeSingle();
      if (existing) continue;

      await admin.from("social_alerts").insert({
        candidate_id: candidateId,
        profile_id: profileId,
        post_id: p.id,
        alert_type: "viral_post",
        severity: growth >= 6 ? "critical" : "warning",
        title: `Post viralizando (${Math.round((growth - 1) * 100)}% em ${Math.round(dtMin)}min)`,
        description: (p.caption || "").slice(0, 200),
        payload: { growth, per_hour: Math.round(perHour), engagement: curEng },
      });
    }
  }

  // competitor_growth: variação de followers no perfil (apenas concorrentes)
  if (profileType === "competitor") {
    const { data: prof } = await admin
      .from("social_profiles")
      .select("followers_count, display_name, username")
      .eq("id", profileId)
      .maybeSingle();

    if (prof?.followers_count) {
      // pega snapshot histórico via primeiro post antigo (proxy simples)
      const { data: lastAlert } = await admin
        .from("social_alerts")
        .select("payload, created_at")
        .eq("profile_id", profileId)
        .eq("alert_type", "competitor_growth")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const prevFollowers = lastAlert?.payload?.followers_count as number | undefined;
      if (prevFollowers && prevFollowers > 0) {
        const delta = prof.followers_count - prevFollowers;
        const pct = delta / prevFollowers;
        if (pct >= 0.02 && delta >= 100) {
          await admin.from("social_alerts").insert({
            candidate_id: candidateId,
            profile_id: profileId,
            alert_type: "competitor_growth",
            severity: pct >= 0.05 ? "warning" : "info",
            title: `${prof.display_name || prof.username} ganhou ${delta} seguidores (+${(pct * 100).toFixed(1)}%)`,
            payload: { followers_count: prof.followers_count, delta, pct },
          });
        }
      } else {
        // primeiro registro de baseline
        await admin.from("social_alerts").insert({
          candidate_id: candidateId,
          profile_id: profileId,
          alert_type: "competitor_growth",
          severity: "info",
          title: `Baseline registrado: ${prof.followers_count} seguidores`,
          payload: { followers_count: prof.followers_count, baseline: true },
        });
      }
    }
  }
}
