import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { META_APP_ID, META_REDIRECT_URI, META_GRAPH_VERSION } from "./meta-oauth";

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

type TokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type DebugTokenResponse = {
  data?: {
    app_id?: string;
    user_id?: string;
    scopes?: string[];
    granular_scopes?: Array<{
      scope?: string;
      target_ids?: string[];
      expired_time?: number;
    }>;
    data_access_expires_at?: number;
    expires_at?: number;
    is_valid?: boolean;
  };
};

type FbError = { error?: { message?: string; type?: string; code?: number } };

async function fbJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json()) as T & FbError;
  if (!res.ok || (json as FbError).error) {
    const msg = (json as FbError).error?.message || `Erro Graph API (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

export const connectMetaAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().min(10).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) throw new Error("META_APP_SECRET não configurado no servidor.");

    // 1+2) Trocar code por user access_token
    const tokenUrl =
      `${GRAPH}/oauth/access_token?` +
      new URLSearchParams({
        client_id: META_APP_ID,
        client_secret: appSecret,
        redirect_uri: META_REDIRECT_URI,
        code: data.code,
      }).toString();

    const tokenRes = await fbJson<TokenResponse>(tokenUrl);
    const userAccessToken = tokenRes.access_token;
    const userExpiresIn = tokenRes.expires_in ?? 0;

    // (opcional) trocar por long-lived user token (60 dias)
    let longLivedToken = userAccessToken;
    let longLivedExpiresIn = userExpiresIn;
    try {
      const llUrl =
        `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: META_APP_ID,
          client_secret: appSecret,
          fb_exchange_token: userAccessToken,
        }).toString();
      const ll = await fbJson<TokenResponse>(llUrl);
      longLivedToken = ll.access_token;
      longLivedExpiresIn = ll.expires_in ?? userExpiresIn;
    } catch {
      // mantém token de curto prazo
    }

    const debugToken = await fbJson<DebugTokenResponse>(
      `${GRAPH}/debug_token?` +
        new URLSearchParams({
          input_token: longLivedToken,
          access_token: `${META_APP_ID}|${appSecret}`,
        }).toString(),
    );

    const tokenDebug = debugToken.data ?? {};
    console.info("[meta-oauth] token debug", {
      is_valid: tokenDebug.is_valid ?? false,
      app_id: tokenDebug.app_id ?? null,
      user_id: tokenDebug.user_id ?? null,
      scopes: tokenDebug.scopes ?? [],
      granular_scopes: tokenDebug.granular_scopes ?? [],
      data_access_expires_at: tokenDebug.data_access_expires_at ?? null,
    });

    // 3) Listar páginas
    const pagesRes = await fbJson<{
      data?: Array<{
        id: string;
        name: string;
        access_token: string;
        tasks?: string[];
        instagram_business_account?: { id: string };
      }>;
    }>(
      `${GRAPH}/me/accounts?` +
        new URLSearchParams({
          fields: "id,name,access_token,tasks,instagram_business_account",
          access_token: longLivedToken,
        }).toString(),
    );

    const pages = pagesRes.data ?? [];
    if (pages.length === 0) {
      const grantedScopes = (tokenDebug.scopes ?? []).join(", ") || "nenhum scope retornado";
      throw new Error(
        `Nenhuma página do Facebook foi retornada por /me/accounts. Scopes concedidos: ${grantedScopes}.`,
      );
    }

    // 5) Primeira página
    const page = pages[0];
    const pageAccessToken = page.access_token;
    const instagramBusinessId = page.instagram_business_account?.id ?? null;

    // 7+8) Buscar username do Instagram
    let instagramUsername: string | null = null;
    let instagramPictureUrl: string | null = null;
    if (instagramBusinessId) {
      try {
        const ig = await fbJson<{ id: string; username?: string; profile_picture_url?: string }>(
          `${GRAPH}/${instagramBusinessId}?` +
            new URLSearchParams({
              fields: "id,username,profile_picture_url",
              access_token: pageAccessToken,
            }).toString(),
        );
        instagramUsername = ig.username ?? null;
        instagramPictureUrl = ig.profile_picture_url ?? null;
      } catch {
        // ignora se o usuário não autorizou instagram_basic
      }
    }

    // foto da página
    let pagePictureUrl: string | null = null;
    try {
      const pic = await fbJson<{ data?: { url?: string } }>(
        `${GRAPH}/${page.id}/picture?redirect=false&type=large&access_token=${pageAccessToken}`,
      );
      pagePictureUrl = pic.data?.url ?? null;
    } catch {
      /* opcional */
    }

    // 9) expires_at
    const expiresAt =
      longLivedExpiresIn > 0
        ? new Date(Date.now() + longLivedExpiresIn * 1000).toISOString()
        : null;

    // 6+10) Salvar — connected somente se page_id existir
    const row = {
      user_id: userId,
      platform: "meta",
      access_token: pageAccessToken,
      page_id: page.id,
      page_name: page.name,
      page_picture_url: pagePictureUrl,
      instagram_business_id: instagramBusinessId,
      instagram_username: instagramUsername,
      instagram_picture_url: instagramPictureUrl,
      expires_at: expiresAt,
      status: page.id ? "connected" : "disconnected",
      metadata: {
        source: "code_oauth",
        granted_at: new Date().toISOString(),
        user_access_token_expires_in: longLivedExpiresIn,
        pages_count: pages.length,
        page_tasks: page.tasks ?? [],
        token_debug: {
          is_valid: tokenDebug.is_valid ?? false,
          app_id: tokenDebug.app_id ?? null,
          user_id: tokenDebug.user_id ?? null,
          scopes: tokenDebug.scopes ?? [],
          granular_scopes:
            tokenDebug.granular_scopes?.map((scope) => ({
              scope: scope.scope ?? null,
              target_ids: scope.target_ids ?? [],
              expired_time: scope.expired_time ?? null,
            })) ?? [],
          data_access_expires_at: tokenDebug.data_access_expires_at ?? null,
        },
      },
    };

    const { error: upErr } = await supabase
      .from("social_connections")
      .upsert(row, { onConflict: "user_id,platform" });
    if (upErr) throw new Error(upErr.message);

    return {
      ok: true,
      page_id: page.id,
      page_name: page.name,
      instagram_business_id: instagramBusinessId,
      instagram_username: instagramUsername,
      expires_at: expiresAt,
    };
  });
