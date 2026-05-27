import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { graphGet, MetaGraphError } from "./meta-graph.server";

const PeriodSchema = z.enum(["7", "30", "90"]);
type Period = z.infer<typeof PeriodSchema>;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

export type DailySeriesPoint = { date: string; value: number };
export type KpiDelta = { current: number; previous: number; delta: number; deltaPct: number | null };

export type TopPost = {
  id: string;
  caption: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  posted_at: string | null;
  likes: number;
  comments: number;
  reach: number;
  engagement: number;
};

export type InsightsResult = {
  period: Period;
  generated_at: string;
  cached: boolean;
  instagram: {
    username: string | null;
    followers: KpiDelta;
    reach: KpiDelta;
    impressions: KpiDelta;
    profile_views: KpiDelta;
    reach_series: DailySeriesPoint[];
    impressions_series: DailySeriesPoint[];
    top_posts: TopPost[];
  } | null;
  facebook: {
    page_name: string | null;
    fans: KpiDelta;
    reach: KpiDelta;
    engagement: KpiDelta;
    reach_series: DailySeriesPoint[];
  } | null;
  warnings: string[];
};

function sumValues(values: Array<{ value: number }>): number {
  return values.reduce((s, v) => s + (Number(v.value) || 0), 0);
}

function makeDelta(current: number, previous: number): KpiDelta {
  const delta = current - previous;
  const deltaPct = previous === 0 ? null : (delta / previous) * 100;
  return { current, previous, delta, deltaPct };
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function unixDaysAgo(days: number): number {
  return Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
}

type IgInsightsResp = {
  data: Array<{
    name: string;
    period: string;
    values: Array<{ value: number; end_time?: string }>;
    total_value?: { value: number };
  }>;
};

type IgMediaResp = {
  data: Array<{
    id: string;
    caption?: string;
    media_type?: string;
    media_url?: string;
    thumbnail_url?: string;
    permalink?: string;
    timestamp?: string;
    like_count?: number;
    comments_count?: number;
  }>;
};

type IgMediaInsightsResp = {
  data: Array<{ name: string; values: Array<{ value: number }> }>;
};

type FbInsightsResp = {
  data: Array<{
    name: string;
    period: string;
    values: Array<{ value: number | Record<string, number>; end_time?: string }>;
  }>;
};

async function fetchInstagramInsights(
  igUserId: string,
  username: string | null,
  pageToken: string,
  days: number,
  warnings: string[],
): Promise<InsightsResult["instagram"]> {
  const sinceCurrent = unixDaysAgo(days);
  const sincePrev = unixDaysAgo(days * 2);
  const untilPrev = sinceCurrent;
  const now = Math.floor(Date.now() / 1000);

  // Day-level series for current window
  let reach_series: DailySeriesPoint[] = [];
  let impressions_series: DailySeriesPoint[] = [];
  let reachCurrent = 0;
  let impressionsCurrent = 0;
  let reachPrev = 0;
  let impressionsPrev = 0;
  try {
    const cur = await graphGet<IgInsightsResp>(
      `${igUserId}/insights`,
      {
        metric: "reach,impressions",
        period: "day",
        since: sinceCurrent,
        until: now,
        metric_type: "total_value",
      },
      pageToken,
    );
    for (const m of cur.data) {
      const series = m.values.map((v) => ({
        date: (v.end_time ?? "").slice(0, 10),
        value: Number(v.value) || 0,
      }));
      if (m.name === "reach") {
        reach_series = series;
        reachCurrent = sumValues(m.values);
      }
      if (m.name === "impressions") {
        impressions_series = series;
        impressionsCurrent = sumValues(m.values);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro insights atual";
    warnings.push(`Instagram reach/impressions: ${msg}`);
  }

  try {
    const prev = await graphGet<IgInsightsResp>(
      `${igUserId}/insights`,
      {
        metric: "reach,impressions",
        period: "day",
        since: sincePrev,
        until: untilPrev,
      },
      pageToken,
    );
    for (const m of prev.data) {
      if (m.name === "reach") reachPrev = sumValues(m.values);
      if (m.name === "impressions") impressionsPrev = sumValues(m.values);
    }
  } catch {
    /* período anterior é opcional */
  }

  // Followers (lifetime metric)
  let followersCurrent = 0;
  let followersPrev = 0;
  try {
    const fc = await graphGet<{ followers_count?: number }>(
      `${igUserId}`,
      { fields: "followers_count" },
      pageToken,
    );
    followersCurrent = Number(fc.followers_count) || 0;
  } catch {
    /* opcional */
  }
  try {
    const flw = await graphGet<IgInsightsResp>(
      `${igUserId}/insights`,
      {
        metric: "follower_count",
        period: "day",
        since: sinceCurrent,
        until: now,
      },
      pageToken,
    );
    const growth = sumValues(flw.data[0]?.values ?? []);
    followersPrev = followersCurrent - growth;
  } catch {
    followersPrev = followersCurrent;
  }

  // Profile views
  let profileViewsCurrent = 0;
  let profileViewsPrev = 0;
  try {
    const pv = await graphGet<IgInsightsResp>(
      `${igUserId}/insights`,
      {
        metric: "profile_views",
        period: "day",
        since: sinceCurrent,
        until: now,
      },
      pageToken,
    );
    profileViewsCurrent = sumValues(pv.data[0]?.values ?? []);
  } catch {
    /* nem todas as contas têm */
  }
  try {
    const pv = await graphGet<IgInsightsResp>(
      `${igUserId}/insights`,
      {
        metric: "profile_views",
        period: "day",
        since: sincePrev,
        until: untilPrev,
      },
      pageToken,
    );
    profileViewsPrev = sumValues(pv.data[0]?.values ?? []);
  } catch {
    /* opcional */
  }

  // Top posts (últimas 25 mídias, ranked por likes+comments)
  let top_posts: TopPost[] = [];
  try {
    const media = await graphGet<IgMediaResp>(
      `${igUserId}/media`,
      {
        fields:
          "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
        limit: 25,
      },
      pageToken,
    );
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).getTime();
    const filtered = media.data.filter((m) => {
      const t = m.timestamp ? new Date(m.timestamp).getTime() : 0;
      return t >= since;
    });
    const enriched = await Promise.all(
      filtered.slice(0, 10).map(async (m) => {
        let reach = 0;
        let engagement = 0;
        try {
          const ins = await graphGet<IgMediaInsightsResp>(
            `${m.id}/insights`,
            { metric: "reach" },
            pageToken,
          );
          for (const row of ins.data) {
            const v = Number(row.values?.[0]?.value) || 0;
            if (row.name === "reach") reach = v;
          }
        } catch {
          /* alguns tipos de mídia não suportam */
        }
        engagement = (m.like_count ?? 0) + (m.comments_count ?? 0);
        return {
          id: m.id,
          caption: m.caption ?? null,
          thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
          permalink: m.permalink ?? null,
          posted_at: m.timestamp ?? null,
          likes: m.like_count ?? 0,
          comments: m.comments_count ?? 0,
          reach,
          engagement,
        } satisfies TopPost;
      }),
    );
    top_posts = enriched.sort((a, b) => b.engagement - a.engagement).slice(0, 5);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro top posts";
    warnings.push(`Instagram top posts: ${msg}`);
  }

  return {
    username,
    followers: makeDelta(followersCurrent, followersPrev),
    reach: makeDelta(reachCurrent, reachPrev),
    impressions: makeDelta(impressionsCurrent, impressionsPrev),
    profile_views: makeDelta(profileViewsCurrent, profileViewsPrev),
    reach_series,
    impressions_series,
    top_posts,
  };
}

async function fetchFacebookInsights(
  pageId: string,
  pageName: string | null,
  pageToken: string,
  days: number,
  warnings: string[],
): Promise<InsightsResult["facebook"]> {
  const sinceCurrent = isoDaysAgo(days);
  const sincePrev = isoDaysAgo(days * 2);
  const today = isoDaysAgo(0);

  let fansCurrent = 0;
  try {
    const fc = await graphGet<{ followers_count?: number; fan_count?: number }>(
      `${pageId}`,
      { fields: "followers_count,fan_count" },
      pageToken,
    );
    fansCurrent = Number(fc.followers_count ?? fc.fan_count) || 0;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro page";
    warnings.push(`Facebook page: ${msg}`);
  }

  let reach_series: DailySeriesPoint[] = [];
  let reachCurrent = 0;
  let reachPrev = 0;
  let engagementCurrent = 0;
  let engagementPrev = 0;
  try {
    const cur = await graphGet<FbInsightsResp>(
      `${pageId}/insights`,
      {
        metric: "page_impressions_unique,page_post_engagements",
        period: "day",
        since: sinceCurrent,
        until: today,
      },
      pageToken,
    );
    for (const m of cur.data) {
      if (m.name === "page_impressions_unique") {
        reach_series = m.values.map((v) => ({
          date: (v.end_time ?? "").slice(0, 10),
          value: typeof v.value === "number" ? v.value : 0,
        }));
        reachCurrent = reach_series.reduce((s, p) => s + p.value, 0);
      }
      if (m.name === "page_post_engagements") {
        engagementCurrent = m.values.reduce(
          (s, v) => s + (typeof v.value === "number" ? v.value : 0),
          0,
        );
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro insights fb";
    warnings.push(`Facebook insights: ${msg}`);
  }

  try {
    const prev = await graphGet<FbInsightsResp>(
      `${pageId}/insights`,
      {
        metric: "page_impressions_unique,page_post_engagements",
        period: "day",
        since: sincePrev,
        until: sinceCurrent,
      },
      pageToken,
    );
    for (const m of prev.data) {
      if (m.name === "page_impressions_unique") {
        reachPrev = m.values.reduce((s, v) => s + (typeof v.value === "number" ? v.value : 0), 0);
      }
      if (m.name === "page_post_engagements") {
        engagementPrev = m.values.reduce(
          (s, v) => s + (typeof v.value === "number" ? v.value : 0),
          0,
        );
      }
    }
  } catch {
    /* opcional */
  }

  return {
    page_name: pageName,
    fans: makeDelta(fansCurrent, fansCurrent),
    reach: makeDelta(reachCurrent, reachPrev),
    engagement: makeDelta(engagementCurrent, engagementPrev),
    reach_series,
  };
}

export const getMetaInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        period: PeriodSchema.default("30"),
        forceRefresh: z.boolean().optional().default(false),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<InsightsResult> => {
    const { supabase, userId } = context;
    const days = parseInt(data.period, 10);

    const { data: conn, error: connErr } = await supabase
      .from("social_connections")
      .select(
        "id, access_token, page_id, page_name, instagram_business_id, instagram_username, status",
      )
      .eq("user_id", userId)
      .eq("platform", "meta")
      .maybeSingle();

    if (connErr) throw new Error(connErr.message);
    if (!conn || !conn.access_token || !conn.page_id) {
      throw new Error("Conexão Meta não encontrada. Conecte sua conta primeiro.");
    }
    if (conn.status !== "connected") {
      throw new Error("Conexão Meta inativa ou expirada. Reconecte sua conta.");
    }

    const cacheKey = "insights_v1";
    if (!data.forceRefresh) {
      const { data: cached } = await supabase
        .from("social_insights_cache")
        .select("data, fetched_at, expires_at")
        .eq("connection_id", conn.id)
        .eq("cache_key", cacheKey)
        .eq("period", data.period)
        .maybeSingle();
      if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
        return { ...(cached.data as InsightsResult), cached: true };
      }
    }

    const warnings: string[] = [];
    const pageToken = conn.access_token;

    let instagram: InsightsResult["instagram"] = null;
    let facebook: InsightsResult["facebook"] = null;

    try {
      if (conn.instagram_business_id) {
        instagram = await fetchInstagramInsights(
          conn.instagram_business_id,
          conn.instagram_username,
          pageToken,
          days,
          warnings,
        );
      }
    } catch (e) {
      if (e instanceof MetaGraphError && e.isTokenError) {
        await supabase
          .from("social_connections")
          .update({ status: "expired" })
          .eq("id", conn.id);
        throw new Error("Token Meta expirado. Reconecte sua conta.");
      }
      warnings.push(
        `Instagram indisponível: ${e instanceof Error ? e.message : "erro desconhecido"}`,
      );
    }

    try {
      facebook = await fetchFacebookInsights(
        conn.page_id,
        conn.page_name,
        pageToken,
        days,
        warnings,
      );
    } catch (e) {
      if (e instanceof MetaGraphError && e.isTokenError) {
        await supabase
          .from("social_connections")
          .update({ status: "expired" })
          .eq("id", conn.id);
        throw new Error("Token Meta expirado. Reconecte sua conta.");
      }
      warnings.push(
        `Facebook indisponível: ${e instanceof Error ? e.message : "erro desconhecido"}`,
      );
    }

    const result: InsightsResult = {
      period: data.period,
      generated_at: new Date().toISOString(),
      cached: false,
      instagram,
      facebook,
      warnings,
    };

    await supabase.from("social_insights_cache").upsert(
      {
        connection_id: conn.id,
        user_id: userId,
        cache_key: cacheKey,
        period: data.period,
        data: result as never,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      },
      { onConflict: "connection_id,cache_key,period" },
    );

    return result;
  });
