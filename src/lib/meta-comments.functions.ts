import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MetaGraphError } from "./meta-graph.server";
import {
  fetchInstagramMedia,
  fetchFacebookPagePosts,
  fetchInstagramComments,
  fetchFacebookComments,
  replyInstagramComment,
  replyFacebookComment,
  hideFacebookComment,
  type RawMedia,
  type RawComment,
} from "./meta-comments.server";

const StatusEnum = z.enum(["pending", "replied", "hidden", "handled"]);
const PlatformEnum = z.enum(["instagram", "facebook"]);

export type CommentStatus = z.infer<typeof StatusEnum>;
export type CommentPlatform = z.infer<typeof PlatformEnum>;

export type SocialCommentRow = {
  id: string;
  platform: CommentPlatform;
  post_external_id: string;
  comment_external_id: string;
  parent_comment_external_id: string | null;
  author_name: string | null;
  author_id: string | null;
  text: string | null;
  posted_at: string | null;
  status: CommentStatus;
  reply_text: string | null;
  replied_at: string | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  sentiment_source: 'ai' | 'human' | null;
  sentiment_confidence: number | null;
  sentiment_reason: string | null;
  needs_review: boolean;
  emotion: string | null;
  topics: string[] | null;
  is_ignored: boolean;
  militant_badge?: string | null;
  post?: {
    caption: string | null;
    thumbnail_url: string | null;
    permalink: string | null;
  } | null;
};

async function getConnection(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("social_connections")
    .select(
      "id, access_token, page_id, page_name, instagram_business_id, instagram_username, status",
    )
    .eq("user_id", userId)
    .eq("platform", "meta")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.access_token) throw new Error("Conexão Meta não encontrada.");
  if (data.status !== "connected") throw new Error("Reconecte sua conta Meta.");
  return data;
}

function handleTokenError(e: unknown, supabase: any, connId: string): never {
  if (e instanceof MetaGraphError && e.isTokenError) {
    void supabase.from("social_connections").update({ status: "expired" }).eq("id", connId);
    throw new Error("Token Meta expirado. Reconecte sua conta.");
  }
  throw e instanceof Error ? e : new Error("Erro desconhecido");
}

// -----------------------------------------------------------------------------
// SYNC: busca posts recentes + comentários e faz upsert
// -----------------------------------------------------------------------------
export const syncMetaComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ postLimit: z.number().min(1).max(25).optional().default(5) })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const conn = await getConnection(supabase, userId);
    const warnings: string[] = [];
    let postsSynced = 0;
    let commentsSynced = 0;

    async function upsertPost(platform: CommentPlatform, m: RawMedia) {
      const caption = m.caption ?? m.message ?? null;
      const thumb = m.thumbnail_url ?? m.media_url ?? m.full_picture ?? null;
      const permalink = m.permalink ?? m.permalink_url ?? null;
      const posted_at = m.timestamp ?? m.created_time ?? null;
      const { error } = await supabase.from("social_posts_cache").upsert(
        {
          user_id: userId,
          connection_id: conn.id,
          platform,
          external_id: m.id,
          caption,
          thumbnail_url: thumb,
          permalink,
          media_type: m.media_type ?? null,
          posted_at,
          metrics: {
            likes: m.like_count ?? null,
            comments: m.comments_count ?? null,
          },
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "connection_id,platform,external_id" },
      );
      if (error) warnings.push(`upsert post ${m.id}: ${error.message}`);
      else postsSynced++;
    }

    async function upsertComments(
      platform: CommentPlatform,
      postExternalId: string,
      list: RawComment[],
    ) {
      if (list.length === 0) return;
      const rows = list.map((c) => ({
        user_id: userId,
        connection_id: conn.id,
        platform,
        post_external_id: postExternalId,
        comment_external_id: c.id,
        parent_comment_external_id: c.parent_id ?? null,
        author_name: c.username ?? c.from?.username ?? c.from?.name ?? null,
        author_id: c.from?.id ?? null,
        text: c.text ?? c.message ?? null,
        posted_at: c.timestamp ?? c.created_time ?? null,
        raw: JSON.parse(JSON.stringify(c)) as never,
      }));
      // upsert atualizando autor/raw em conflitos (sem tocar em colunas de status/replies).
      const { error } = await supabase
        .from("social_comments")
        .upsert(rows, {
          onConflict: "connection_id,platform,comment_external_id",
          ignoreDuplicates: false,
        });
      if (error) warnings.push(`upsert comments ${postExternalId}: ${error.message}`);
      else commentsSynced += rows.length;
    }

    async function processPost(platform: CommentPlatform, m: RawMedia) {
      await upsertPost(platform, m);
      // Stub comment entry to ensure post is visible in lists even with 0 comments
      const stubId = `post_stub_${m.id}`;
      await supabase.from("social_comments").upsert({
        user_id: userId,
        connection_id: conn.id,
        platform,
        post_external_id: m.id,
        comment_external_id: stubId,
        text: null,
        status: 'handled',
        is_ignored: true
      }, { onConflict: "connection_id,platform,comment_external_id" });

      try {
        const cs = platform === "instagram"
          ? await fetchInstagramComments(m.id, conn.access_token)
          : await fetchFacebookComments(m.id, conn.access_token);
        await upsertComments(platform, m.id, cs);
      } catch (e) {
        warnings.push(`${platform} comments ${m.id}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }

    async function syncPlatform(
      platform: CommentPlatform,
      fetchMedia: () => Promise<RawMedia[]>,
    ) {
      try {
        const media = await fetchMedia();
        await Promise.all(media.map((m) => processPost(platform, m)));
      } catch (e) {
        try {
          handleTokenError(e, supabase, conn.id);
        } catch (err) {
          warnings.push(`${platform}: ${err instanceof Error ? err.message : "erro"}`);
        }
      }
    }

    const tasks: Promise<void>[] = [];
    if (conn.instagram_business_id) {
      tasks.push(syncPlatform("instagram", () =>
        fetchInstagramMedia(conn.instagram_business_id, conn.access_token, data.postLimit),
      ));
    }
    if (conn.page_id) {
      tasks.push(syncPlatform("facebook", () =>
        fetchFacebookPagePosts(conn.page_id, conn.access_token, data.postLimit),
      ));
    }
    await Promise.all(tasks);

    return { postsSynced, commentsSynced, warnings };
  });

// -----------------------------------------------------------------------------
// LIST: lê comentários do banco com filtros
// -----------------------------------------------------------------------------
export const listSocialComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      platform: PlatformEnum.optional(),
      status: StatusEnum.optional(),
      sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
      postExternalId: z.string().optional(),
      showIgnored: z.boolean().optional().default(false),
      showReplied: z.boolean().optional().default(true),
      search: z.string().optional(),
      limit: z.number().min(1).max(200).optional().default(100),
    }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<{
    comments: SocialCommentRow[];
    counts: Record<CommentStatus, number>;
  }> => {
    const { supabase, userId } = context;

    // Só mostra comentários da(s) conexão(ões) Meta atualmente vinculada(s)
    // ao usuário. Conexões antigas (já removidas/substituídas) deixam linhas
    // órfãs em social_comments — não devem aparecer no inbox.
    const { data: activeConns, error: connErr } = await supabase
      .from("social_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("platform", "meta")
      .eq("status", "connected");
    if (connErr) throw new Error(connErr.message);
    const activeIds = (activeConns ?? []).map((c: { id: string }) => c.id);

    if (activeIds.length === 0) {
      return {
        comments: [],
        counts: { pending: 0, replied: 0, hidden: 0, handled: 0 },
      };
    }

    let q = supabase
      .from("social_comments")
      .select(
        "id, platform, post_external_id, comment_external_id, parent_comment_external_id, author_name, author_id, text, posted_at, status, reply_text, replied_at, sentiment, emotion, topics, is_ignored, sentiment_source, sentiment_confidence, sentiment_reason, needs_review",
      )
      .eq("user_id", userId)
      .in("connection_id", activeIds)
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(data.limit);

    if (data.platform) q = q.eq("platform", data.platform);
    if (data.status) q = q.eq("status", data.status);
    if (data.sentiment) q = q.eq("sentiment", data.sentiment);
    if (data.postExternalId) q = q.eq("post_external_id", data.postExternalId);
    if (!data.showIgnored) q = q.eq("is_ignored", false);
    if (!data.showReplied) q = q.neq("status", "replied");
    if (data.search) q = q.ilike("text", `%${data.search}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // join manual com posts cache
    const postIds = Array.from(new Set((rows ?? []).map((r: any) => r.post_external_id)));
    const authorIds = Array.from(new Set((rows ?? []).map((r: any) => r.author_id).filter(Boolean)));
    
    let postMap = new Map<string, { caption: string | null; thumbnail_url: string | null; permalink: string | null }>();
    let militantMap = new Map<string, string | null>();

    if (authorIds.length > 0) {
      const { data: militants } = await supabase
        .from("social_militants")
        .select("platform_user_id, current_badge")
        .eq("user_id", userId)
        .in("platform_user_id", authorIds);
      for (const m of militants ?? []) {
        militantMap.set(m.platform_user_id, m.current_badge);
      }
    }
    if (postIds.length > 0) {
      const { data: posts } = await supabase
        .from("social_posts_cache")
        .select("external_id, caption, thumbnail_url, permalink")
        .eq("user_id", userId)
        .in("connection_id", activeIds)
        .in("external_id", postIds);
      for (const p of posts ?? []) {
        postMap.set(p.external_id, {
          caption: p.caption,
          thumbnail_url: p.thumbnail_url,
          permalink: p.permalink,
        });
      }
    }

    // contagens por status (apenas da conexão ativa)
    const { data: countsRaw } = await supabase
      .from("social_comments")
      .select("status")
      .eq("user_id", userId)
      .in("connection_id", activeIds);
    const counts: Record<CommentStatus, number> = {
      pending: 0, replied: 0, hidden: 0, handled: 0,
    };
    for (const r of countsRaw ?? []) counts[(r as { status: CommentStatus }).status]++;

    const comments: SocialCommentRow[] = (rows ?? []).map((r: any) => ({
      ...r,
      militant_badge: militantMap.get(r.author_id) ?? 'observador',
      post: postMap.get(r.post_external_id) ?? null,
    }));
    return { comments, counts };
  });


// -----------------------------------------------------------------------------
// REPLY
// -----------------------------------------------------------------------------
export const replySocialComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      commentId: z.string().uuid(),
      message: z.string().min(1).max(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: c, error: cErr } = await supabase
      .from("social_comments")
      .select("id, platform, comment_external_id, connection_id")
      .eq("id", data.commentId)
      .eq("user_id", userId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!c) throw new Error("Comentário não encontrado.");

    const conn = await getConnection(supabase, userId);
    if (conn.id !== c.connection_id) throw new Error("Conexão divergente.");

    try {
      const res = c.platform === "instagram"
        ? await replyInstagramComment(c.comment_external_id, data.message, conn.access_token)
        : await replyFacebookComment(c.comment_external_id, data.message, conn.access_token);

      await supabase.from("social_comments").update({
        status: "replied",
        reply_text: data.message,
        replied_at: new Date().toISOString(),
        replied_external_id: res.id,
      }).eq("id", c.id);

      return { ok: true, externalId: res.id };
    } catch (e) {
      handleTokenError(e, supabase, conn.id);
    }
  });

// -----------------------------------------------------------------------------
// UPDATE STATUS (handled/hidden/pending)
// -----------------------------------------------------------------------------
export const updateCommentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      commentId: z.string().uuid(),
      status: StatusEnum,
      hideOnPlatform: z.boolean().optional().default(false),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: c, error } = await supabase
      .from("social_comments")
      .select("id, platform, comment_external_id, connection_id")
      .eq("id", data.commentId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Comentário não encontrado.");

    if (data.hideOnPlatform && c.platform === "facebook") {
      const conn = await getConnection(supabase, userId);
      try {
        await hideFacebookComment(
          c.comment_external_id,
          data.status === "hidden",
          conn.access_token,
        );
      } catch (e) {
        handleTokenError(e, supabase, conn.id);
      }
    }

    const { error: updErr } = await supabase
      .from("social_comments")
      .update({ status: data.status })
      .eq("id", c.id);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

export const toggleIgnoreComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      commentId: z.string().uuid(),
      isIgnored: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("social_comments")
      .update({ is_ignored: data.isIgnored })
      .eq("id", data.commentId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
