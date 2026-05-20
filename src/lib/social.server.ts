// Server-only helpers for Social Intelligence Engine (Fase 1).
// NEVER import from client code.
import { createHmac, timingSafeEqual } from "crypto";

export function socialHmacSecret(): string {
  const s = process.env.SOCIAL_HMAC_SECRET;
  if (!s) throw new Error("SOCIAL_HMAC_SECRET not configured");
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
  if (!signatureHeader || !timestampHeader) {
    return { ok: false, reason: "missing signature/timestamp" };
  }
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad timestamp" };
  const skew = Math.abs(Date.now() / 1000 - ts);
  if (skew > 300) return { ok: false, reason: "timestamp skew" };

  const expected = createHmac("sha256", socialHmacSecret())
    .update(`${rawBody}.${ts}`)
    .digest("hex");
  const received = signatureHeader.replace(/^sha256=/, "").trim();
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(received, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "bad signature" };
    }
  } catch {
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
