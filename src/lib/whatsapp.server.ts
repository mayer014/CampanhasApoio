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
  hour_cap: number;
  warmup_enabled: boolean;
  warmup_started_at: string | null;
  warmup_day: number;
}> {
  const { data, error } = await sb
    .from("whatsapp_instances")
    .select(
      "id, candidate_id, instance_id, api_key, status, phone_number, webhook_registered, daily_cap, quiet_hours_start, quiet_hours_end, hour_cap, warmup_enabled, warmup_started_at, warmup_day, last_qr, last_connected_at"
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
  const processUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const processViteUrl = normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL);
  const importMetaViteUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
  const url = processUrl || processViteUrl || importMetaViteUrl || SUPABASE_URL_FALLBACK;
  const urlSource = processUrl
    ? "process.env.SUPABASE_URL"
    : processViteUrl
      ? "process.env.VITE_SUPABASE_URL"
      : importMetaViteUrl
        ? "import.meta.env.VITE_SUPABASE_URL"
        : "fallback.constant";

  const processKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const processViteKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const importMetaViteKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const key = processKey || processViteKey || importMetaViteKey || SUPABASE_PUBLISHABLE_KEY_FALLBACK;
  const keySource = processKey
    ? "process.env.SUPABASE_PUBLISHABLE_KEY"
    : processViteKey
      ? "process.env.VITE_SUPABASE_PUBLISHABLE_KEY"
      : importMetaViteKey
        ? "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"
        : "fallback.constant";

  return { url, key, urlSource, keySource };
}

/** Validate Supabase access token -> user id (decode JWT local, sem HTTP). */
export async function userIdFromToken(token: string): Promise<string> {
  const { userIdFromJwt } = await import("@/lib/jwt-decode.server");
  return userIdFromJwt(token);
}

/** Create a Supabase client scoped to the authenticated user token (RLS applies). */
export async function userClientFromToken(token: string): Promise<SupabaseClient> {
  const { createClient } = await import("@supabase/supabase-js");
  const { url, key, urlSource, keySource } = resolveSupabasePublicEnv();

  console.log("[social.debug] userClientFromToken ENV CHECK", {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: !!process.env.SUPABASE_PUBLISHABLE_KEY,
    PROCESS_VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
    PROCESS_VITE_SUPABASE_PUBLISHABLE_KEY: !!process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    IMPORT_META_VITE_SUPABASE_URL: !!import.meta.env.VITE_SUPABASE_URL,
    IMPORT_META_VITE_SUPABASE_PUBLISHABLE_KEY: !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    resolvedUrlSource: urlSource,
    resolvedKeySource: keySource,
    hasToken: !!token,
  });

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

/** Is current time inside the quiet hours window (BRT)? */
export function isQuietHour(start: number, end: number): boolean {
  const now = new Date();
  const utcH = now.getUTCHours();
  const brtH = (utcH - 3 + 24) % 24;
  if (start === end) return false;
  if (start < end) return brtH >= start && brtH < end;
  return brtH >= start || brtH < end;
}

/** Current Brasília hour/minute/weekday (0=Sun..6=Sat). */
function brNow(): { hour: number; minute: number; weekday: number; date: Date } {
  const now = new Date();
  const utcH = now.getUTCHours();
  const hour = (utcH - 3 + 24) % 24;
  const minute = now.getUTCMinutes();
  // weekday adjusting for BRT (UTC-3)
  const shifted = new Date(now.getTime() - 3 * 3600_000);
  const weekday = shifted.getUTCDay();
  return { hour, minute, weekday, date: now };
}

export function randBetween(min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(min + Math.random() * (max - min + 1));
}

/** Render spintax: {a|b|c} → random choice. Supports nesting. */
export function renderSpintax(text: string): string {
  if (!text || !text.includes("{")) return text;
  let prev = "";
  let cur = text;
  let safety = 10;
  while (cur !== prev && safety-- > 0) {
    prev = cur;
    cur = cur.replace(/\{([^{}]+)\}/g, (full, body: string) => {
      if (!body.includes("|")) return full;
      const opts = body.split("|");
      return opts[Math.floor(Math.random() * opts.length)] ?? "";
    });
  }
  return cur;
}

/** Replace simple {nome} placeholder AND render spintax. */
export function applyTemplate(
  text: string,
  vars: Record<string, string | null | undefined>
): string {
  // 1) substitute known variables (only when key is in vars), leaving spintax intact
  const sub = text.replace(/\{(\w+)\}/g, (full, k) => {
    if (Object.prototype.hasOwnProperty.call(vars, k)) {
      const v = vars[k];
      return v == null ? "" : String(v);
    }
    return full; // keep braces, may be spintax later
  });
  // 2) render spintax
  return renderSpintax(sub);
}

const OPT_OUT_FOOTER =
  "\n\n_Para não receber mais mensagens, responda SAIR._";

const OPT_OUT_KEYWORDS = [
  "sair",
  "parar",
  "remover",
  "remova",
  "descadastrar",
  "descadastre",
  "stop",
  "cancelar",
  "unsubscribe",
];

/** Detect opt-out intent from an incoming message text. */
export function detectOptOutKeyword(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.trim().toLowerCase().replace(/[.!?,;]/g, "");
  if (!t) return false;
  if (t.length > 30) return false; // long messages aren't opt-out commands
  return OPT_OUT_KEYWORDS.some((k) => t === k || t === `${k} por favor`);
}

/** Pick one media URL from rotation list (falls back to single media_url). */
function pickMedia(urls: string[] | null | undefined, single: string | null): string | null {
  const list = (urls || []).filter(Boolean);
  if (list.length === 0) return single || null;
  return list[Math.floor(Math.random() * list.length)];
}

/** Effective daily cap considering warm-up. */
function effectiveDailyCap(inst: {
  daily_cap: number;
  warmup_enabled: boolean;
  warmup_started_at: string | null;
  warmup_day: number;
}, bcCap: number): number {
  let cap = Math.min(bcCap, inst.daily_cap);
  if (inst.warmup_enabled && inst.warmup_started_at) {
    const daysIn = Math.floor(
      (Date.now() - new Date(inst.warmup_started_at).getTime()) / (24 * 3600_000)
    ) + 1;
    const day = Math.max(1, Math.min(daysIn, inst.warmup_day || daysIn));
    const ramp =
      day <= 1 ? 20 :
      day === 2 ? 40 :
      day === 3 ? 80 :
      day === 4 ? 120 :
      day === 5 ? 160 :
      day === 6 ? 200 : 300;
    cap = Math.min(cap, ramp);
  }
  return cap;
}

/** Count of messages sent in last hour by candidate. */
async function hourSentCount(sb: SupabaseClient, candidateId: string): Promise<number> {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await sb
    .from("whatsapp_send_log")
    .select("*", { count: "exact", head: true })
    .eq("candidate_id", candidateId)
    .eq("status", "sent")
    .gte("created_at", since);
  return count || 0;
}

/** True if jid was already messaged within `hours` for this candidate. */
async function recentlyContacted(
  sb: SupabaseClient,
  candidateId: string,
  jid: string,
  hours: number
): Promise<boolean> {
  if (hours <= 0) return false;
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const { count } = await sb
    .from("whatsapp_send_log")
    .select("*", { count: "exact", head: true })
    .eq("candidate_id", candidateId)
    .eq("jid", jid)
    .eq("status", "sent")
    .gte("created_at", since);
  return (count || 0) > 0;
}

/** Check if current BR time is inside any allowed window. Empty array = allow all. */
function inDaytimeWindow(windows: Array<{ start: string; end: string }>, hour: number, minute: number): boolean {
  if (!windows || windows.length === 0) return true;
  const cur = hour * 60 + minute;
  for (const w of windows) {
    const [sh, sm] = (w.start || "00:00").split(":").map((n) => parseInt(n) || 0);
    const [eh, em] = (w.end || "23:59").split(":").map((n) => parseInt(n) || 0);
    const s = sh * 60 + sm;
    const e = eh * 60 + em;
    if (s <= e ? (cur >= s && cur < e) : (cur >= s || cur < e)) return true;
  }
  return false;
}

/** Send typing presence; ignore failures. */
async function sendTypingPresence(apiKey: string, jid: string, ms: number) {
  try {
    await bridge("send_presence", { jid, presence: "composing" }, { apiKey });
    await new Promise((r) => setTimeout(r, Math.min(ms, 8000)));
    await bridge("send_presence", { jid, presence: "paused" }, { apiKey });
  } catch {
    /* ignore */
  }
}

/** Recent failure rate (last 20 sends for the broadcast). */
async function recentFailureRate(sb: SupabaseClient, broadcastId: string): Promise<number> {
  const { data } = await sb
    .from("whatsapp_broadcast_recipients")
    .select("status")
    .eq("broadcast_id", broadcastId)
    .in("status", ["sent", "failed"])
    .order("sent_at", { ascending: false })
    .limit(20);
  if (!data || data.length < 5) return 0;
  const fails = data.filter((r: any) => r.status === "failed").length;
  return fails / data.length;
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

      const { hour, minute, weekday } = brNow();

      // Weekday filter
      const allowedDays: number[] = bc.allowed_weekdays || [0, 1, 2, 3, 4, 5, 6];
      if (!allowedDays.includes(weekday)) {
        const next = new Date(Date.now() + 30 * 60_000);
        await supabaseAdmin
          .from("whatsapp_broadcasts")
          .update({ next_send_at: next.toISOString() })
          .eq("id", bc.id);
        details.push({ id: bc.id, skip: "weekday not allowed" });
        continue;
      }

      // Daytime windows
      const windows = (Array.isArray(bc.daytime_windows) ? bc.daytime_windows : []) as Array<{ start: string; end: string }>;
      if (!inDaytimeWindow(windows, hour, minute)) {
        const next = new Date(Date.now() + 15 * 60_000);
        await supabaseAdmin
          .from("whatsapp_broadcasts")
          .update({ next_send_at: next.toISOString() })
          .eq("id", bc.id);
        details.push({ id: bc.id, skip: "outside daytime window" });
        continue;
      }

      // Quiet hours
      if (bc.respect_quiet_hours && isQuietHour(inst.quiet_hours_start, inst.quiet_hours_end)) {
        const next = new Date(Date.now() + 5 * 60_000);
        await supabaseAdmin
          .from("whatsapp_broadcasts")
          .update({ next_send_at: next.toISOString() })
          .eq("id", bc.id);
        details.push({ id: bc.id, skip: "quiet hours" });
        continue;
      }

      // Daily cap (with warm-up)
      const cap = effectiveDailyCap(inst, bc.daily_cap);
      const sentToday = await dailySentCount(supabaseAdmin as any, bc.candidate_id);
      if (sentToday >= cap) {
        const next = new Date();
        next.setDate(next.getDate() + 1);
        next.setHours(0, 5, 0, 0);
        await supabaseAdmin
          .from("whatsapp_broadcasts")
          .update({ next_send_at: next.toISOString() })
          .eq("id", bc.id);
        details.push({ id: bc.id, skip: "daily cap reached", cap });
        continue;
      }

      // Hour cap
      const hourCap = Math.min(bc.hour_cap || 60, inst.hour_cap || 60);
      const sentHour = await hourSentCount(supabaseAdmin as any, bc.candidate_id);
      if (sentHour >= hourCap) {
        const next = new Date(Date.now() + 10 * 60_000);
        await supabaseAdmin
          .from("whatsapp_broadcasts")
          .update({ next_send_at: next.toISOString() })
          .eq("id", bc.id);
        details.push({ id: bc.id, skip: "hour cap reached", hourCap });
        continue;
      }

      // Circuit breaker: pause if failure rate too high
      const failRate = await recentFailureRate(supabaseAdmin as any, bc.id);
      if (failRate >= 0.4) {
        await supabaseAdmin
          .from("whatsapp_broadcasts")
          .update({ status: "paused", next_send_at: null })
          .eq("id", bc.id);
        details.push({ id: bc.id, skip: "circuit breaker (high failure rate)", failRate });
        continue;
      }

      // Pick next recipient — shuffle by ordering by random hash of jid+id
      // Cheap shuffle: pick from first 50 pending then random
      const { data: rcptPool } = await supabaseAdmin
        .from("whatsapp_broadcast_recipients")
        .select("*")
        .eq("broadcast_id", bc.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(bc.shuffle_recipients === false ? 1 : 50);

      const rcpt = rcptPool && rcptPool.length > 0
        ? (bc.shuffle_recipients === false
            ? rcptPool[0]
            : rcptPool[Math.floor(Math.random() * rcptPool.length)])
        : null;

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

      // Opt-out check
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

      // Recipient cooldown — don't message same person too often
      const cooldownH = bc.recipient_cooldown_hours ?? 0;
      if (cooldownH > 0 && (await recentlyContacted(supabaseAdmin as any, bc.candidate_id, rcpt.jid, cooldownH))) {
        await supabaseAdmin
          .from("whatsapp_broadcast_recipients")
          .update({ status: "skipped", error_message: `cooldown ${cooldownH}h` })
          .eq("id", rcpt.id);
        await supabaseAdmin
          .from("whatsapp_broadcasts")
          .update({ skipped_count: bc.skipped_count + 1 })
          .eq("id", bc.id);
        details.push({ id: bc.id, skipped: rcpt.jid, reason: "cooldown" });
        processed++;
        continue;
      }

      // Build message: variables + spintax + optional footer
      const vars = (rcpt.variables || {}) as Record<string, string>;
      if (rcpt.display_name && !vars.nome) vars.nome = rcpt.display_name;
      let text = applyTemplate(bc.message_text, vars);
      if (bc.append_optout_footer) text += OPT_OUT_FOOTER;

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

      // Typing presence (simulate composition)
      if (bc.simulate_typing && !isGroup) {
        const typingMs = Math.max(1500, Math.min(8000, Math.floor((text.length / 40) * 1000)));
        await sendTypingPresence(inst.api_key, rcpt.jid, typingMs);
      }

      // Media: pick from rotation if any
      const mediaUrl = pickMedia(bc.media_urls, bc.media_url);
      const action = mediaUrl ? "send_media" : "send";
      const payload: Record<string, unknown> = {};
      if (mediaUrl) {
        payload.media_url = mediaUrl;
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
        const isBlocked = status === 403 || status === 429 || /forbidden|blocked|banned|rate/i.test(errMsg);
        if (status === 409 || /not connected/i.test(errMsg) || isBlocked) {
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

      // Long pause every N sends
      const longEvery = bc.long_pause_every || 25;
      const longMin = bc.long_pause_seconds_min || 300;
      const longMax = bc.long_pause_seconds_max || 900;
      const intervalSec =
        longEvery > 0 && newSent > 0 && newSent % longEvery === 0
          ? randBetween(longMin, longMax)
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

