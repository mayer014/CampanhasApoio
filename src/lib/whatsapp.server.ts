// Server-only helpers for the WhatsApp module.
// NEVER import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BRIDGE_URL =
  "https://vxqvrsaxppbgxookyimz.supabase.co/functions/v1/whatsapp-bridge";

const APP_BASE_URL =
  process.env.APP_BASE_URL ||
  "https://project--7a279b36-7b6b-4e1c-bf0e-253f1a812c48.lovable.app";

/** Webhook URL the WhatsHub motor should POST events to. */
export function webhookUrl(): string {
  return `${APP_BASE_URL}/api/public/whatsapp/webhook`;
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

/** Low-level call to the WhatsHub Bridge. */
export async function bridge(
  action: string,
  payload: Record<string, unknown>,
  auth: { apiKey?: string; master?: boolean }
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth.master) {
    const token = process.env.WHATSHUB_MASTER_TOKEN;
    if (!token) throw new Error("WHATSHUB_MASTER_TOKEN not configured");
    headers["X-Bridge-Token"] = token;
  } else {
    if (!auth.apiKey) throw new Error("Bridge call without api key");
    headers["X-Api-Key"] = auth.apiKey;
  }
  const res = await fetch(BRIDGE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...payload }),
  });
  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

/** Get the API key + ownership for a candidate. Throws if missing. */
export async function getInstanceForUser(userId: string): Promise<{
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
  const { data, error } = await supabaseAdmin
    .from("whatsapp_instances")
    .select(
      "id, candidate_id, instance_id, api_key, status, phone_number, webhook_registered, daily_cap, quiet_hours_start, quiet_hours_end"
    )
    .eq("candidate_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Instância WhatsApp não configurada");
  return data as any;
}

/** Resolve effective candidate target: admin can act on behalf of any user. */
export async function resolveTargetCandidate(
  callerId: string,
  targetCandidateId?: string | null
): Promise<string> {
  if (!targetCandidateId || targetCandidateId === callerId) return callerId;
  // Check admin
  const { data: r } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .maybeSingle();
  if (!r) throw new Error("Forbidden");
  return targetCandidateId;
}

/** Validate Supabase access token -> user id */
export async function userIdFromToken(token: string): Promise<string> {
  const { createClient } = await import("@supabase/supabase-js");
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid or expired token");
  return data.user.id;
}

/** Check daily cap usage for an instance. Returns sent count today. */
export async function dailySentCount(candidateId: string): Promise<number> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin
    .from("whatsapp_send_log")
    .select("*", { count: "exact", head: true })
    .eq("candidate_id", candidateId)
    .eq("status", "sent")
    .gte("created_at", since.toISOString());
  return count || 0;
}

/** Is current time inside the quiet hours window? */
export function isQuietHour(start: number, end: number): boolean {
  // Use server's local hour (Brazil-relevant). On Cloudflare workerd it's UTC, so
  // convert to BRT (UTC-3) for politicians' typical schedule.
  const now = new Date();
  const utcH = now.getUTCHours();
  const brtH = (utcH - 3 + 24) % 24;
  if (start === end) return false;
  if (start < end) return brtH >= start && brtH < end;
  // window crosses midnight (e.g. 22 -> 7)
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
