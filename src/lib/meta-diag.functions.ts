import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { graphGet, MetaGraphError } from "./meta-graph.server";
import { META_APP_ID } from "./meta-oauth";
import {
  fetchFacebookPagePosts,
  fetchFacebookComments,
} from "./meta-comments.server";

const CRITICAL_SCOPES = [
  "pages_read_user_content",
  "pages_manage_engagement",
  "pages_show_list",
  "pages_read_engagement",
  "instagram_manage_comments",
  "instagram_manage_insights",
];

async function ensureAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado: requer role admin.");
}

async function loadConn(supabase: SupabaseClient, connectionId: string) {
  const { data, error } = await supabase
    .from("social_connections")
    .select("id, user_id, platform, access_token, page_id, page_name, instagram_business_id, instagram_username, status, expires_at")
    .eq("id", connectionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Conexão não encontrada (ou sem permissão RLS).");
  if (!data.access_token) throw new Error("Conexão sem token.");
  return data;
}

export const listMetaConnectionsForDiag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    await ensureAdmin(supabase, context.userId);
    const { data, error } = await supabase
      .from("social_connections")
      .select("id, user_id, page_id, page_name, instagram_username, status, updated_at")
      .eq("platform", "meta")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{
      id: string;
      user_id: string;
      page_id: string | null;
      page_name: string | null;
      instagram_username: string | null;
      status: string | null;
      updated_at: string | null;
    }>;
    const userIds = Array.from(new Set(rows.map((d) => d.user_id)));
    const { data: profiles } = await supabase
      .from("candidate_profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    const byId = new Map(
      ((profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>)
        .map((p) => [p.id, p] as const),
    );

    return rows.map((d) => ({
      id: d.id,
      page_id: d.page_id,
      page_name: d.page_name,
      instagram_username: d.instagram_username,
      status: d.status,
      updated_at: d.updated_at,
      candidate: byId.get(d.user_id) ?? null,
    }));
  });

export const getMetaAppInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ connectionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const conn = await loadConn(context.supabase, data.connectionId);
    const token = conn.access_token!;
    const appSecret = process.env.META_APP_SECRET;

    let app: { id?: string; name?: string; namespace?: string; link?: string } | null = null;
    let appError: string | null = null;
    try {
      app = await graphGet(
        META_APP_ID,
        { fields: "id,name,namespace,link" },
        token,
      );
    } catch (e) {
      appError = e instanceof Error ? e.message : String(e);
    }

    // debug_token: requer app access token (app_id|app_secret)
    type DebugTokenData = {
      app_id?: string;
      type?: string;
      application?: string;
      user_id?: string;
      expires_at?: number;
      data_access_expires_at?: number;
      is_valid?: boolean;
      scopes?: string[];
      profile_id?: string;
      issued_at?: number;
    };
    let debug: DebugTokenData | null = null;
    let debugError: string | null = null;

    if (!appSecret) {
      debugError = "META_APP_SECRET não configurado no servidor — não foi possível inspecionar escopos.";
    } else {
      try {
        const appAccess = `${META_APP_ID}|${appSecret}`;
        const r = await graphGet<{ data: DebugTokenData }>(
          "debug_token",
          { input_token: token },
          appAccess,
        );
        debug = r.data ?? null;
      } catch (e) {
        debugError = e instanceof Error ? e.message : String(e);
      }
    }

    const scopes = debug?.scopes ?? [];
    const scopeStatus = CRITICAL_SCOPES.map((s) => ({
      scope: s,
      granted: scopes.includes(s),
    }));

    // Heurística: page token tem profile_id == page_id e não tem user_id próprio diferente
    const tokenKind = debug?.type ?? "desconhecido";

    return {
      conn: {
        page_id: conn.page_id,
        page_name: conn.page_name,
        ig_business_id: conn.instagram_business_id,
        ig_username: conn.instagram_username,
        status: conn.status,
        expires_at: conn.expires_at,
      },
      app: { info: app, error: appError },
      debug: {
        data: debug,
        error: debugError,
        token_kind: tokenKind,
        all_scopes: scopes,
        scope_status: scopeStatus,
      },
    };
  });

export const getMetaDiagSample = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      connectionId: z.string().uuid(),
      rehydrate: z.boolean().optional().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const conn = await loadConn(context.supabase, data.connectionId);
    if (!conn.page_id) throw new Error("Conexão sem page_id.");
    const token = conn.access_token!;

    type Row = {
      post_id: string;
      comment_id: string;
      author_id: string | null;
      author_name: string | null;
      message: string;
      hydrated: boolean;
    };

    const posts = await fetchFacebookPagePosts(conn.page_id, token, 5);
    const rows: Row[] = [];
    const errors: string[] = [];

    for (const post of posts) {
      try {
        const comments = await fetchFacebookComments(post.id, token);
        for (const c of comments.slice(0, 10)) {
          rows.push({
            post_id: post.id,
            comment_id: c.id,
            author_id: c.from?.id ?? null,
            author_name: c.from?.name ?? null,
            message: (c.text ?? "").slice(0, 80),
            hydrated: false,
          });
        }
      } catch (e) {
        errors.push(`post ${post.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (data.rehydrate) {
      for (const row of rows) {
        if (row.author_name) continue;
        try {
          const full = await graphGet<{ from?: { id?: string; name?: string } }>(
            row.comment_id,
            { fields: "id,from{id,name}" },
            token,
          );
          if (full.from?.name) {
            row.author_id = full.from.id ?? row.author_id;
            row.author_name = full.from.name;
            row.hydrated = true;
          }
        } catch (e) {
          if (e instanceof MetaGraphError) {
            errors.push(`hidratar ${row.comment_id}: ${e.message}`);
          }
        }
      }
    }

    const total = rows.length;
    const withName = rows.filter((r) => !!r.author_name).length;

    return {
      posts_scanned: posts.length,
      total_comments: total,
      with_author_name: withName,
      pct_with_name: total === 0 ? 0 : Math.round((withName / total) * 100),
      rows,
      errors,
    };
  });
