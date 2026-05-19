// Server-only helpers for the WhatsApp module.
// NEVER import from client code.
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@/integrations/supabase/url";

const BRIDGE_URL =
  "https://vxqvrsaxppbgxookyimz.supabase.co/functions/v1/whatsapp-bridge";

function resolveAppBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ||
    "https://project--7a279b36-7b6b-4e1c-bf0e-253f1a812c48.lovable.app"
  );
}

/** Webhook URL the WhatsHub motor should POST events to. */
export function webhookUrl(): string {
  return `${resolveAppBaseUrl()}/api/public/whatsapp/webhook`;
}

/** 13-digit BR phone normalizer: 55 + DDD + 9 + 8 digits. */
export function normalizePhoneBR(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) throw new Error("Telefone vazio");
  if (d.startsWith("0")) d = d.slice(1);
  if (!d.startsWith("55")) d = "55" + d;
  const ddd = d.slice(2, 4);
  let num = d.slice(4);
  if (num.length === 8) num = "9" + num;
  d = "55" + ddd + num;
  if (d.length !== 13) throw new Error("Telefone BR inválido: " + raw);
  return d;
}

function resolveSupabaseUrl(): string {
  return (
    normalizeSupabaseUrl(process.env.SUPABASE_URL) ||
    normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL) ||
    "https://pfppmkqsdqawvykkgafe.supabase.co"
  );
}

function resolveSupabaseAnonKey(): string {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmcHBta3FzZHFhd3Z5a2tnYWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjM3MzcsImV4cCI6MjA5MzE5OTczN30.LkEeROQWXN2HkRsEiiI4sjzBQf4OdDVuuCep48wL3Rg"
  );
}

/** Low-level call to the WhatsHub Bridge.
 *  - `master: true` → goes through the Supabase Edge Function `whatsapp-bridge-proxy`
 *    (so WHATSHUB_MASTER_TOKEN lives as a Supabase secret, not as an env on the app server)
 *  - `apiKey` → calls the bridge directly with the instance api key
 */
export async function bridge(
  action: string,
  payload: Record<string, unknown>,
  auth: { apiKey?: string; master?: boolean; accessToken?: string | null }
): Promise<{ status: number; data: any }> {
  if (auth.master) {
    if (!auth.accessToken) {
      throw new Error("Bridge master call requires user access token");
    }
    const supabaseUrl = resolveSupabaseUrl();
    const anonKey = resolveSupabaseAnonKey();
    const proxyUrl = `${supabaseUrl}/functions/v1/whatsapp-bridge-proxy`;
    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify({ action, payload }),
    });
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }
    if (!res.ok) {
      return {
        status: res.status,
        data: { error: parsed?.error || `proxy ${res.status}` },
      };
    }
    // Edge function returns { status, data } — unwrap to keep callers untouched.
    return {
      status: typeof parsed?.status === "number" ? parsed.status : 200,
      data: parsed?.data ?? parsed,
    };
  }

  if (!auth.apiKey) throw new Error("Bridge call without api key");
  const res = await fetch(BRIDGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": auth.apiKey,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

/** Get the API key + ownership for a candidate. Throws if missing. */
export async function getInstanceForUser(
  sb: SupabaseClient,
  candidateId: string
): Promise<{
  id: string;
  candidate_id: string;
  instance_id: string | null;
  api_key: string | null;
  status: string;
  phone_number: string | null;
  webhook_registered: boolean;
  daily_cap: number;
  quiet_hours_start: number;
  quiet_hours_end: number;
}> {
  const { data, error } = await sb
    .from("whatsapp_instances")
    .select(
      "id, candidate_id, instance_id, api_key, status, phone_number, webhook_registered, daily_cap, quiet_hours_start, quiet_hours_end"
    )
    .eq("candidate_id", candidateId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Instância WhatsApp não configurada");
  return data as any;
}

/** Resolve effective candidate target: admin can act on behalf of any user. */
export async function resolveTargetCandidate(
  sb: SupabaseClient,
  callerId: string,
  targetCandidateId?: string | null
): Promise<string> {
  if (!targetCandidateId || targetCandidateId === callerId) return callerId;
  const { data: r } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .maybeSingle();
  if (!r) throw new Error("Forbidden");
  return targetCandidateId;
}

const SUPABASE_URL_FALLBACK = "https://pfppmkqsdqawvykkgafe.supabase.co";
const SUPABASE_PUBLISHABLE_KEY_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmcHBta3FzZHFhd3Z5a2tnYWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjM3MzcsImV4cCI6MjA5MzE5OTczN30.LkEeROQWXN2HkRsEiiI4sjzBQf4OdDVuuCep48wL3Rg";

function resolveSupabasePublicEnv() {
  const url =
    normalizeSupabaseUrl(process.env.SUPABASE_URL) ||
    normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL) ||
    SUPABASE_URL_FALLBACK;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    SUPABASE_PUBLISHABLE_KEY_FALLBACK;
  return { url, key };
}

/** Validate Supabase access token -> user id (decode JWT local, sem HTTP). */
export async function userIdFromToken(token: string): Promise<string> {
  const { userIdFromJwt } = await import("@/lib/jwt-decode.server");
  return userIdFromJwt(token);
}

/** Create a Supabase client scoped to the authenticated user token (RLS applies). */
export async function userClientFromToken(token: string): Promise<SupabaseClient> {
  const { createClient } = await import("@supabase/supabase-js");
  const { url, key } = resolveSupabasePublicEnv();

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}


/** Check daily cap usage for an instance. Returns sent count today. */
export async function dailySentCount(
  sb: SupabaseClient,
  candidateId: string
): Promise<number> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count } = await sb
    .from("whatsapp_send_log")
    .select("*", { count: "exact", head: true })
    .eq("candidate_id", candidateId)
    .eq("status", "sent")
    .gte("created_at", since.toISOString());
  return count || 0;
}

/** Is current time inside the quiet hours window? */
export function isQuietHour(start: number, end: number): boolean {
  const now = new Date();
  const utcH = now.getUTCHours();
  const brtH = (utcH - 3 + 24) % 24;
  if (start === end) return false;
  if (start < end) return brtH >= start && brtH < end;
  return brtH >= start || brtH < end;
}

export function randBetween(min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(min + Math.random() * (max - min + 1));
}

/** Replace simple {nome} placeholder. */
export function applyTemplate(
  text: string,
  vars: Record<string, string | null | undefined>
): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v == null ? "" : String(v);
  });
}

/**
 * Process pending broadcasts. Server-only — uses service role.
 */
export async function tickBroadcastsInternal(): Promise<{
  processed: number;
  details: any[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: running } = await supabaseAdmin
    .from("whatsapp_broadcasts")
    .select("*")
    .eq("status", "running")
    .order("started_at", { ascending: true })
    .limit(20);

  const details: any[] = [];
  let processed = 0;

  for (const bc of running || []) {
    try {
      if (bc.next_send_at && new Date(bc.next_send_at) > new Date()) {
        details.push({ id: bc.id, skip: "waiting interval" });
        continue;
      }
      const inst = await getInstanceForUser(supabaseAdmin as any, bc.candidate_id).catch(() => null);
      if (!inst || !inst.api_key) {
        await supabaseAdmin
          .from("whatsapp_broadcasts")
          .update({ status: "failed" })
          .eq("id", bc.id);
        details.push({ id: bc.id, skip: "no instance" });
        continue;
      }

      if (bc.respect_quiet_hours && isQuietHour(inst.quiet_hours_start, inst.quiet_hours_end)) {
        const next = new Date(Date.now() + 5 * 60_000);
        await supabaseAdmin
          .from("whatsapp_broadcasts")
          .update({ next_send_at: next.toISOString() })
          .eq("id", bc.id);
        details.push({ id: bc.id, skip: "quiet hours" });
        continue;
      }

      const cap = Math.min(bc.daily_cap, inst.daily_cap);
      const sentToday = await dailySentCount(supabaseAdmin as any, bc.candidate_id);
      if (sentToday >= cap) {
        const next = new Date();
        next.setDate(next.getDate() + 1);
        next.setHours(0, 5, 0, 0);
        await supabaseAdmin
          .from("whatsapp_broadcasts")
          .update({ next_send_at: next.toISOString() })
          .eq("id", bc.id);
        details.push({ id: bc.id, skip: "daily cap reached" });
        continue;
      }

      const { data: rcpt } = await supabaseAdmin
        .from("whatsapp_broadcast_recipients")
        .select("*")
        .eq("broadcast_id", bc.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!rcpt) {
        await supabaseAdmin
          .from("whatsapp_broadcasts")
          .update({
            status: "completed",
            finished_at: new Date().toISOString(),
          })
          .eq("id", bc.id);
        details.push({ id: bc.id, done: true });
        continue;
      }

      const { data: opt } = await supabaseAdmin
        .from("whatsapp_optouts")
        .select("id")
        .eq("candidate_id", bc.candidate_id)
        .eq("jid", rcpt.jid)
        .maybeSingle();

      if (opt) {
        await supabaseAdmin
          .from("whatsapp_broadcast_recipients")
          .update({ status: "skipped", error_message: "opt-out" })
          .eq("id", rcpt.id);
        await supabaseAdmin
          .from("whatsapp_broadcasts")
          .update({ skipped_count: bc.skipped_count + 1 })
          .eq("id", bc.id);
        details.push({ id: bc.id, skipped: rcpt.jid });
        processed++;
        continue;
      }

      const vars = (rcpt.variables || {}) as Record<string, string>;
      if (rcpt.display_name && !vars.nome) vars.nome = rcpt.display_name;
      const text = applyTemplate(bc.message_text, vars);

      const isGroup = rcpt.jid.endsWith("@g.us");
      const phone = !isGroup
        ? (() => {
            try {
              return normalizePhoneBR(rcpt.jid.split("@")[0]);
            } catch {
              return null;
            }
          })()
        : null;

      if (!isGroup && !phone) {
        await supabaseAdmin
          .from("whatsapp_broadcast_recipients")
          .update({ status: "failed", error_message: "telefone inválido" })
          .eq("id", rcpt.id);
        await supabaseAdmin
          .from("whatsapp_broadcasts")
          .update({ failed_count: bc.failed_count + 1 })
          .eq("id", bc.id);
        processed++;
        continue;
      }

      const action = bc.media_url ? "send_media" : "send";
      const payload: Record<string, unknown> = {};
      if (bc.media_url) {
        payload.media_url = bc.media_url;
        payload.caption = text;
      } else {
        payload.message = text;
      }
      if (isGroup) payload.group_jid = rcpt.jid;
      else payload.phone = phone;

      const { status, data: res } = await bridge(action, payload, {
        apiKey: inst.api_key,
      });

      if (status >= 400 || !res?.success) {
        const errMsg = res?.error || `HTTP ${status}`;
        if (status === 409 || /not connected/i.test(errMsg)) {
          await supabaseAdmin
            .from("whatsapp_broadcasts")
            .update({ status: "paused", next_send_at: null })
            .eq("id", bc.id);
        }
        await supabaseAdmin
          .from("whatsapp_broadcast_recipients")
          .update({ status: "failed", error_message: errMsg })
          .eq("id", rcpt.id);
        await supabaseAdmin
          .from("whatsapp_broadcasts")
          .update({ failed_count: bc.failed_count + 1 })
          .eq("id", bc.id);
        await supabaseAdmin.from("whatsapp_send_log").insert({
          candidate_id: bc.candidate_id,
          jid: rcpt.jid,
          broadcast_id: bc.id,
          status: "failed",
        });
        details.push({ id: bc.id, jid: rcpt.jid, error: errMsg });
        processed++;
        continue;
      }

      await supabaseAdmin
        .from("whatsapp_broadcast_recipients")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          message_id: res.messageId || null,
        })
        .eq("id", rcpt.id);

      const newSent = bc.sent_count + 1;
      const intervalSec =
        newSent > 0 && newSent % 50 === 0
          ? randBetween(300, 600)
          : randBetween(bc.interval_min_seconds, bc.interval_max_seconds);

      const next = new Date(Date.now() + intervalSec * 1000);

      const allDone = newSent + bc.failed_count + bc.skipped_count + 1 >= bc.total;
      await supabaseAdmin
        .from("whatsapp_broadcasts")
        .update({
          sent_count: newSent,
          next_send_at: allDone ? null : next.toISOString(),
          status: allDone ? "completed" : "running",
          finished_at: allDone ? new Date().toISOString() : null,
        })
        .eq("id", bc.id);

      await supabaseAdmin.from("whatsapp_send_log").insert({
        candidate_id: bc.candidate_id,
        jid: rcpt.jid,
        broadcast_id: bc.id,
        status: "sent",
      });

      processed++;
      details.push({ id: bc.id, sent: rcpt.jid, nextInSec: intervalSec });
    } catch (e: any) {
      details.push({ id: bc.id, error: e?.message || String(e) });
    }
  }

  return { processed, details };
}
