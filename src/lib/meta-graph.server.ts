// Server-only helper: Meta Graph API client.
// Never import from client code.

import { META_GRAPH_VERSION } from "./meta-oauth";

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export type GraphError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

export class MetaGraphError extends Error {
  status: number;
  code?: number;
  subcode?: number;
  isTokenError: boolean;

  constructor(message: string, opts: { status: number; code?: number; subcode?: number }) {
    super(message);
    this.status = opts.status;
    this.code = opts.code;
    this.subcode = opts.subcode;
    // 190 = invalid/expired oauth token, 102 = session expired, 463/467 = expired
    this.isTokenError =
      opts.code === 190 ||
      opts.code === 102 ||
      opts.subcode === 463 ||
      opts.subcode === 467;
  }
}

export async function graphGet<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  accessToken: string,
): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  qs.set("access_token", accessToken);
  const url = `${GRAPH}/${path.replace(/^\//, "")}?${qs.toString()}`;
  const res = await fetch(url);
  const json = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || (json as GraphError).error) {
    const e = (json as GraphError).error;
    throw new MetaGraphError(e?.message || `Graph API erro ${res.status}`, {
      status: res.status,
      code: e?.code,
      subcode: e?.error_subcode,
    });
  }
  return json;
}
