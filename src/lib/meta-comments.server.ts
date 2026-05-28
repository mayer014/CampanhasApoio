// Server-only: Graph API helpers for fetching/replying comments.
import { graphGet, MetaGraphError } from "./meta-graph.server";
import { META_GRAPH_VERSION } from "./meta-oauth";

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export type RawComment = {
  id: string;
  text?: string;
  message?: string;
  timestamp?: string;
  created_time?: string;
  username?: string;
  from?: { id?: string; name?: string; username?: string };
  parent_id?: string;
  hidden?: boolean;
  like_count?: number;
};

export type RawMedia = {
  id: string;
  caption?: string;
  message?: string;
  media_type?: string;
  thumbnail_url?: string;
  media_url?: string;
  full_picture?: string;
  permalink?: string;
  permalink_url?: string;
  timestamp?: string;
  created_time?: string;
  like_count?: number;
  comments_count?: number;
};

export async function fetchInstagramMedia(
  igUserId: string,
  token: string,
  limit = 15,
): Promise<RawMedia[]> {
  const res = await graphGet<{ data: RawMedia[] }>(
    `${igUserId}/media`,
    {
      fields:
        "id,caption,media_type,thumbnail_url,media_url,permalink,timestamp,like_count,comments_count",
      limit,
    },
    token,
  );
  return res.data ?? [];
}

export async function fetchFacebookPagePosts(
  pageId: string,
  token: string,
  limit = 15,
): Promise<RawMedia[]> {
  const res = await graphGet<{ data: RawMedia[] }>(
    `${pageId}/posts`,
    {
      fields:
        "id,message,full_picture,permalink_url,created_time",
      limit,
    },
    token,
  );
  return res.data ?? [];
}

export async function fetchInstagramComments(
  mediaId: string,
  token: string,
): Promise<RawComment[]> {
  const res = await graphGet<{ data: RawComment[] }>(
    `${mediaId}/comments`,
    {
      fields: "id,text,timestamp,username,from,parent_id,hidden,like_count",
      limit: 50,
    },
    token,
  );
  return res.data ?? [];
}

export async function fetchFacebookComments(
  postId: string,
  token: string,
): Promise<RawComment[]> {
  // IMPORTANTE: para receber o nome do autor é preciso:
  // 1) usar o PAGE ACCESS TOKEN (não user token) — já garantido em getConnection
  // 2) ter a permissão pages_read_user_content concedida — já está em META_SCOPES
  // 3) pedir explicitamente os subcampos de `from` (from{id,name,picture})
  // Sem os subcampos explícitos a Graph API v17+ frequentemente devolve `from` vazio.
  // Também usamos `filter=stream` para incluir respostas e `order=reverse_chronological`.
  let res: { data: RawComment[] };
  try {
    res = await graphGet<{ data: RawComment[] }>(
      `${postId}/comments`,
      {
        fields: "id,message,created_time,from{id,name,picture},parent{id},like_count",
        filter: "stream",
        order: "reverse_chronological",
        limit: 50,
      },
      token,
    );
  } catch {
    // Fallback: alguns tipos de página/post rejeitam `filter=stream` ou subcampos.
    res = await graphGet<{ data: RawComment[] }>(
      `${postId}/comments`,
      {
        fields: "id,message,created_time,from{id,name},parent,like_count",
        limit: 50,
      },
      token,
    );
  }
  // normalize message → text
  return (res.data ?? []).map((c) => ({
    ...c,
    text: c.text ?? c.message,
    timestamp: c.timestamp ?? c.created_time,
  }));
}

async function graphPost<T>(
  path: string,
  body: Record<string, string>,
  token: string,
): Promise<T> {
  const url = `${GRAPH}/${path.replace(/^\//, "")}`;
  const form = new URLSearchParams({ ...body, access_token: token });
  const res = await fetch(url, {
    method: "POST",
    body: form,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const json = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string; code?: number; error_subcode?: number };
  };
  if (!res.ok || (json as { error?: unknown }).error) {
    const e = (json as { error?: { message?: string; code?: number; error_subcode?: number } }).error;
    throw new MetaGraphError(e?.message || `Graph POST erro ${res.status}`, {
      status: res.status,
      code: e?.code,
      subcode: e?.error_subcode,
    });
  }
  return json;
}

export async function replyInstagramComment(
  commentId: string,
  message: string,
  token: string,
): Promise<{ id: string }> {
  return graphPost<{ id: string }>(`${commentId}/replies`, { message }, token);
}

export async function replyFacebookComment(
  commentId: string,
  message: string,
  token: string,
): Promise<{ id: string }> {
  return graphPost<{ id: string }>(`${commentId}/comments`, { message }, token);
}

export async function hideFacebookComment(
  commentId: string,
  hide: boolean,
  token: string,
): Promise<void> {
  await graphPost(`${commentId}`, { is_hidden: hide ? "true" : "false" }, token);
}
