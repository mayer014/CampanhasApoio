import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  META_APP_ID,
  META_REDIRECT_URI,
  META_GRAPH_VERSION,
} from "./meta-oauth";

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

type TokenResponse = { access_token: string; token_type?: string; expires_in?: number };
type FbError = { error?: { message?: string; type?: string; code?: number; error_subcode?: number } };

async function fbJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = (await res.json()) as T & FbError;
  if (!res.ok || (json as FbError).error) {
    const msg = (json as FbError).error?.message || `Erro Graph API (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

function tokenFingerprint(t: string): string {
  if (!t) return "";
  return `${t.slice(0, 6)}…${t.slice(-4)} (len=${t.length})`;
}

async function debugTokenRaw(token: string, appAccess: string): Promise<unknown> {
  const url = `${GRAPH}/debug_token?` + new URLSearchParams({ input_token: token, access_token: appAccess }).toString();
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  return json;
}

async function exchangeCodeAndSave(
  userId: string,
  code: string,
) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) throw new Error("META_APP_SECRET não configurado no servidor.");
  const appAccess = `${META_APP_ID}|${appSecret}`;

  // 1) code -> short-lived user token
  const tokenUrl =
    `${GRAPH}/oauth/access_token?` +
    new URLSearchParams({
      client_id: META_APP_ID,
      client_secret: appSecret,
      redirect_uri: META_REDIRECT_URI,
      code,
    }).toString();
  const tokenRes = await fbJson<TokenResponse>(tokenUrl);
  const shortToken = tokenRes.access_token;
  const shortExpiresIn = tokenRes.expires_in ?? 0;

  // 2) debug do token curto
  const shortDebug = await debugTokenRaw(shortToken, appAccess);

  // 3) tentar long-lived
  let longToken = shortToken;
  let longExpiresIn = shortExpiresIn;
  let longLivedAttempted = false;
  let longLivedError: string | null = null;
  try {
    longLivedAttempted = true;
    const ll = await fbJson<TokenResponse>(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: META_APP_ID,
          client_secret: appSecret,
          fb_exchange_token: shortToken,
        }).toString(),
    );
    longToken = ll.access_token;
    longExpiresIn = ll.expires_in ?? shortExpiresIn;
  } catch (e) {
    longLivedError = e instanceof Error ? e.message : "fb_exchange_token falhou";
  }

  // 4) debug do token longo
  const longDebug = await debugTokenRaw(longToken, appAccess);

  // 5) /me/accounts — captura URL, status, headers e corpo bruto
  const meAccountsUrl =
    `${GRAPH}/me/accounts?` +
    new URLSearchParams({
      fields: "id,name,access_token,tasks,instagram_business_account",
      access_token: longToken,
    }).toString();
  const meRes = await fetch(meAccountsUrl);
  const meHeaders: Record<string, string> = {};
  meRes.headers.forEach((v, k) => {
    const kk = k.toLowerCase();
    if (
      kk.startsWith("x-") ||
      kk === "www-authenticate" ||
      kk === "content-type" ||
      kk === "facebook-api-version"
    ) {
      meHeaders[k] = v;
    }
  });
  const meBody = (await meRes.json().catch(() => ({}))) as {
    data?: Array<{
      id: string;
      name: string;
      access_token: string;
      tasks?: string[];
      instagram_business_account?: { id: string };
    }>;
    paging?: unknown;
    error?: unknown;
  };
  let pages = meBody.data ?? [];

  // FALLBACK NPE (New Pages Experience): páginas novas não aparecem em /me/accounts
  // mesmo para admins. Tentamos consultar diretamente cada page_id que o usuário marcou
  // na tela de permissões (vêm em granular_scopes.pages_show_list.target_ids).
  let npeFallbackTried = false;
  const npeAttempts: Array<{ page_id: string; ok: boolean; error?: string }> = [];
  if (pages.length === 0) {
    const granular = (shortDebug as {
      data?: { granular_scopes?: Array<{ scope: string; target_ids?: string[] }> };
    })?.data?.granular_scopes ?? [];
    const selectedPageIds = granular.find((g) => g.scope === "pages_show_list")?.target_ids ?? [];

    if (selectedPageIds.length > 0) {
      npeFallbackTried = true;
      const recovered: typeof pages = [];
      for (const pid of selectedPageIds) {
        // Try with `tasks` first; some page types (NPE/classic-com-restrição) não expõem o campo
        // e retornam (#100) Tried accessing nonexisting field (tasks). Fazemos fallback sem `tasks`.
        const fieldSets = [
          "id,name,access_token,tasks,instagram_business_account",
          "id,name,access_token,instagram_business_account",
          "id,name,access_token",
        ];
        let lastErr: string | null = null;
        let got: {
          id: string;
          name: string;
          access_token?: string;
          tasks?: string[];
          instagram_business_account?: { id: string };
        } | null = null;
        for (const fields of fieldSets) {
          try {
            got = await fbJson(
              `${GRAPH}/${pid}?` +
                new URLSearchParams({ fields, access_token: longToken }).toString(),
            );
            break;
          } catch (e) {
            lastErr = e instanceof Error ? e.message : "erro";
            // só tenta o próximo fieldset se o erro for de campo inexistente
            if (!/nonexisting field|\(#100\)/i.test(lastErr)) break;
          }
        }
        if (got?.access_token) {
          recovered.push({ ...got, access_token: got.access_token, tasks: got.tasks });
          npeAttempts.push({ page_id: pid, ok: true });
        } else {
          npeAttempts.push({
            page_id: pid,
            ok: false,
            error: lastErr ?? "sem access_token",
          });
        }
      }

      if (recovered.length > 0) pages = recovered;
    }
  }

  console.info("[meta-oauth] diag", {
    short_token_fp: tokenFingerprint(shortToken),
    long_token_fp: tokenFingerprint(longToken),
    long_lived_attempted: longLivedAttempted,
    long_lived_error: longLivedError,
    short_debug: shortDebug,
    long_debug: longDebug,
    me_accounts: {
      url: `${GRAPH}/me/accounts?fields=id,name,access_token,tasks,instagram_business_account&access_token=<redacted>`,
      status: meRes.status,
      headers: meHeaders,
      body: meBody,
      pages_count: meBody.data?.length ?? 0,
    },
    npe_fallback: { tried: npeFallbackTried, attempts: npeAttempts, recovered_count: pages.length },
  });

  if (pages.length === 0) {
    console.error("[meta-oauth] no pages returned (npe fallback also failed)", JSON.stringify({
      npe_attempts: npeAttempts,
      short_debug: shortDebug,
      long_debug: longDebug,
    }));

    const granular = (shortDebug as { data?: { granular_scopes?: Array<{ scope: string; target_ids?: string[] }> } })
      ?.data?.granular_scopes ?? [];
    const selectedPageIds = granular.find((g) => g.scope === "pages_show_list")?.target_ids ?? [];

    const baseMsg =
      "Não conseguimos acessar nenhuma página do Facebook dessa conta. Isso geralmente acontece em 3 situações:\n\n" +
      "1) Você não é Admin da página (apenas Editor, Moderador ou Anunciante não bastam).\n" +
      "2) A página usa a \"Nova Experiência de Páginas\" — nesse caso, ela precisa estar vinculada ao Business Manager com você como Admin.\n" +
      "3) Você não marcou nenhuma página na tela de permissões do Facebook (passou direto).\n\n" +
      "O que fazer: abra facebook.com/settings → Páginas (ou o Meta Business Suite), confirme que você é Admin da página, e tente conectar novamente marcando-a na lista.";

    const extra = selectedPageIds.length > 0
      ? `\n\nVocê marcou ${selectedPageIds.length} página(s) na tela de permissões (IDs: ${selectedPageIds.join(", ")}), e tentamos buscar cada uma diretamente, mas o Facebook negou acesso. Detalhe técnico: ${npeAttempts.map((a) => `${a.page_id}=${a.ok ? "ok" : a.error}`).join("; ")}`
      : "\n\nVocê não marcou nenhuma página na tela de permissões do Facebook. Refaça a conexão e selecione pelo menos uma página.";

    throw new Error(baseMsg + extra);
  }

  // Se a conta gerencia várias páginas, preferimos a que tem Instagram
  // Business vinculado — caso contrário o usuário pode escolher uma página
  // (Moreninhas) que não tem IG anexado e perder a conexão do Insta de outra
  // página (Radio Radar) selecionada no mesmo fluxo.
  const pageWithIg = pages.find((p) => p.instagram_business_account?.id);
  const page = pageWithIg ?? pages[0];
  const pageAccessToken = page.access_token;
  const instagramBusinessId = page.instagram_business_account?.id ?? null;


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
    } catch { /* opcional */ }
  }

  let pagePictureUrl: string | null = null;
  try {
    const pic = await fbJson<{ data?: { url?: string } }>(
      `${GRAPH}/${page.id}/picture?redirect=false&type=large&access_token=${pageAccessToken}`,
    );
    pagePictureUrl = pic.data?.url ?? null;
  } catch { /* opcional */ }

  const expiresAt =
    longExpiresIn > 0 ? new Date(Date.now() + longExpiresIn * 1000).toISOString() : null;

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
      user_access_token_expires_in: longExpiresIn,
      pages_count: pages.length,
      page_tasks: page.tasks ?? [],
      debug_token_short: shortDebug,
      debug_token_long: longDebug,
    },
  };

  const { error: upErr } = await supabaseAdmin
    .from("social_connections")
    .upsert(row as any, { onConflict: "user_id,platform" });
  if (upErr) throw new Error(`Falha ao salvar social_connection: ${upErr.message}`);

  // Lista de TODAS as páginas retornadas pelo Graph, para o usuário saber
  // quais ficaram disponíveis (mas não foram conectadas, pois só guardamos 1
  // página + IG dela por usuário).
  const availablePages = pages.map((p) => ({
    id: p.id,
    name: p.name,
    has_instagram: Boolean(p.instagram_business_account?.id),
  }));
  const otherPages = availablePages.filter((p) => p.id !== page.id);
  let warning: string | null = null;
  if (otherPages.length > 0) {
    warning =
      `Foram autorizadas ${pages.length} páginas, mas só uma conexão é mantida por vez. ` +
      `Conectamos "${page.name}"${instagramUsername ? ` (com Instagram @${instagramUsername})` : ""}. ` +
      `Outras: ${otherPages.map((p) => `${p.name}${p.has_instagram ? " [+IG]" : ""}`).join(", ")}. ` +
      `Para usar outra página, desconecte e reconecte marcando apenas a página desejada na tela do Facebook.`;
  } else if (!instagramBusinessId) {
    // Usuário pediu acesso a IG mas a página conectada não tem IG vinculado.
    const igTargets = (shortDebug as { data?: { granular_scopes?: Array<{ scope: string; target_ids?: string[] }> } })
      ?.data?.granular_scopes?.find((g) => g.scope === "instagram_basic" || g.scope === "instagram_manage_comments")
      ?.target_ids ?? [];
    if (igTargets.length > 0) {
      warning =
        `A página "${page.name}" não tem Instagram Business vinculado. ` +
        `O Instagram autorizado (${igTargets.join(", ")}) está conectado a OUTRA página do Facebook. ` +
        `Para usar esse Instagram, reconecte selecionando a página do Facebook à qual ele está vinculado.`;
    }
  }

  return {
    ok: true,
    page_id: page.id,
    page_name: page.name,
    instagram_business_id: instagramBusinessId,
    instagram_username: instagramUsername,
    expires_at: expiresAt,
    available_pages: availablePages,
    warning,
  };
}


export const connectMetaAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().min(10).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    return exchangeCodeAndSave(context.userId, data.code);
  });

