import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  applyTemplate,
  bridge,
  dailySentCount,
  getInstanceForUser,
  isQuietHour,
  normalizePhoneBR,
  randBetween,
  resolveTargetCandidate,
  userClientFromToken,
  userIdFromToken,
  webhookUrl,
} from "./whatsapp.server";

const TokenInput = z.object({
  access_token: z.string().min(10),
  candidate_id: z.string().uuid().optional().nullable(),
});

/* ===================== INSTANCE ===================== */

export const createInstance = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({ name: z.string().min(1).max(100) }).parse(input)
  )
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const candidateId = await resolveTargetCandidate(
      sb,
      callerId,
      data.candidate_id
    );

    const { data: prof } = await sb
      .from("candidate_profiles")
      .select("full_name")
      .eq("id", candidateId)
      .maybeSingle();

    const instanceName =
      data.name ||
      (prof?.full_name ? `WhatsApp ${prof.full_name}` : `WhatsApp ${candidateId.slice(0, 6)}`);

    const { data: existing } = await sb
      .from("whatsapp_instances")
      .select("*")
      .eq("candidate_id", candidateId)
      .maybeSingle();

    const { status, data: res } = await bridge(
      "create_instance",
      {
        name: instanceName,
        webhook_url: webhookUrl(),
      },
      { master: true }
    );
    if (status >= 400 || !res?.success) {
      throw new Error(res?.error || `Bridge create_instance failed (${status})`);
    }

    const apiKey = res.api_key as string | undefined;
    const instanceId = res.instance?.id as string | undefined;
    const phone = res.instance?.phone_number || null;
    const remoteStatus =
      (res.instance?.status as "connected" | "connecting" | "disconnected") ||
      "connecting";
    const qrcode = res.qrcode as string | undefined;

    const row = {
      candidate_id: candidateId,
      instance_id: instanceId || existing?.instance_id || null,
      name: instanceName,
      phone_number: phone,
      status: remoteStatus,
      api_key: apiKey || existing?.api_key || null,
      webhook_registered: true,
      last_qr: qrcode || null,
      last_connected_at: remoteStatus === "connected" ? new Date().toISOString() : existing?.last_connected_at || null,
    };

    if (existing) {
      await sb.from("whatsapp_instances").update(row).eq("id", existing.id);
    } else {
      await sb.from("whatsapp_instances").insert(row);
    }

    return {
      success: true,
      reused: !!res.reused,
      status: remoteStatus,
      qrcode: qrcode || null,
    };
  });

export const getInstanceStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const candidateId = await resolveTargetCandidate(sb, callerId, data.candidate_id);
    const inst = await getInstanceForUser(sb, candidateId).catch(() => null);
    if (!inst || !inst.api_key) {
      return {
        configured: false as const,
        status: "disconnected" as const,
        qrcode: null,
        phone_number: null,
      };
    }
    const { status, data: res } = await bridge(
      "instance_status",
      {},
      { apiKey: inst.api_key }
    );
    if (status >= 400) {
      return {
        configured: true as const,
        status: "disconnected" as const,
        qrcode: null,
        phone_number: inst.phone_number,
        error: res?.error || `status ${status}`,
      };
    }
    const newStatus = (res.status || "disconnected") as
      | "connected"
      | "connecting"
      | "disconnected";
    await sb
      .from("whatsapp_instances")
      .update({
        status: newStatus,
        phone_number: res.phone_number || inst.phone_number,
        last_qr: res.qrcode || null,
        last_connected_at:
          newStatus === "connected" ? new Date().toISOString() : inst.status === "connected" ? new Date().toISOString() : null,
      })
      .eq("candidate_id", candidateId);
    return {
      configured: true as const,
      status: newStatus,
      qrcode: (res.qrcode as string | null) || null,
      phone_number: (res.phone_number as string | null) || inst.phone_number,
    };
  });

export const reconnectInstance = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const candidateId = await resolveTargetCandidate(sb, callerId, data.candidate_id);
    const inst = await getInstanceForUser(sb, candidateId);
    if (!inst.api_key) throw new Error("Instância sem API key");
    const { status, data: res } = await bridge("reconnect", {}, { apiKey: inst.api_key });
    if (status >= 400) throw new Error(res?.error || `reconnect ${status}`);
    return { success: true };
  });

export const disconnectInstance = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const candidateId = await resolveTargetCandidate(sb, callerId, data.candidate_id);
    const inst = await getInstanceForUser(sb, candidateId);
    if (!inst.api_key) throw new Error("Instância sem API key");
    await bridge("disconnect", {}, { apiKey: inst.api_key });
    await sb
      .from("whatsapp_instances")
      .update({ status: "disconnected" })
      .eq("candidate_id", candidateId);
    return { success: true };
  });

export const updateInstanceSettings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({
      daily_cap: z.number().int().min(10).max(1000),
      quiet_hours_start: z.number().int().min(0).max(23),
      quiet_hours_end: z.number().int().min(0).max(23),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const candidateId = await resolveTargetCandidate(sb, callerId, data.candidate_id);
    await sb
      .from("whatsapp_instances")
      .update({
        daily_cap: data.daily_cap,
        quiet_hours_start: data.quiet_hours_start,
        quiet_hours_end: data.quiet_hours_end,
      })
      .eq("candidate_id", candidateId);
    return { success: true };
  });

/* ===================== SYNC ===================== */

/** Normalize WhatsHub timestamps which can be number, Long {low,high}, or string. */
function tsToIso(t: any): string | null {
  if (t == null) return null;
  if (typeof t === "number" && isFinite(t)) {
    return new Date(t * 1000).toISOString();
  }
  if (typeof t === "string" && /^\d+$/.test(t)) {
    return new Date(parseInt(t, 10) * 1000).toISOString();
  }
  if (typeof t === "object" && typeof t.low === "number") {
    const v = (t.high || 0) * 4294967296 + (t.low >>> 0);
    return new Date(v * 1000).toISOString();
  }
  return null;
}

export const syncChats = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const candidateId = await resolveTargetCandidate(sb, callerId, data.candidate_id);
    const inst = await getInstanceForUser(sb, candidateId);
    if (!inst.api_key) throw new Error("Instância sem API key");
    const { status, data: res } = await bridge("chats", {}, { apiKey: inst.api_key });
    if (status >= 400) throw new Error(res?.error || `chats ${status}`);

    // Bridge can return either a bare array or an object { chats: [...] } / { data: [...] }
    const chats: any[] = Array.isArray(res)
      ? res
      : Array.isArray(res?.chats)
      ? res.chats
      : Array.isArray(res?.data)
      ? res.data
      : [];

    const chatRows = chats
      .map((c: any) => {
        const jid: string | undefined = c.id || c.jid || c.remoteJid;
        if (!jid) return null;
        const isGroup = !!(c.isGroup ?? c.is_group ?? jid.endsWith("@g.us"));
        return {
          candidate_id: candidateId,
          jid,
          name: c.name || c.subject || c.pushName || null,
          is_group: isGroup,
          unread_count: c.unreadCount || c.unread_count || 0,
          last_message_text: c.lastMessage?.text || c.last_message_text || null,
          last_message_at: tsToIso(c.lastMessage?.timestamp ?? c.last_message_at),
          last_message_from_me: c.lastMessage?.fromMe ?? c.last_message_from_me ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    let chatErr: string | null = null;
    if (chatRows.length) {
      const { error } = await sb
        .from("whatsapp_chats")
        .upsert(chatRows, { onConflict: "candidate_id,jid" });
      if (error) chatErr = error.message;
    }

    const groupRows = chats
      .filter((c: any) => {
        const jid = c.id || c.jid || c.remoteJid || "";
        return c.isGroup || c.is_group || jid.endsWith("@g.us");
      })
      .map((c: any) => ({
        candidate_id: candidateId,
        jid: c.id || c.jid,
        name: c.name || c.subject || null,
        participants_count: c.participants_count ?? c.participantsCount ?? null,
        is_admin: !!(c.isAdmin ?? c.is_admin ?? c.iAmAdmin),
        last_message_at: tsToIso(c.lastMessage?.timestamp),
        last_synced_at: new Date().toISOString(),
      }))
      .filter((r: any) => !!r.jid);

    let grpErr: string | null = null;
    if (groupRows.length) {
      const { error } = await sb
        .from("whatsapp_groups")
        .upsert(groupRows, { onConflict: "candidate_id,jid" });
      if (error) grpErr = error.message;
    }

    if (chatErr || grpErr) {
      throw new Error(
        `Falha ao gravar: ${chatErr || ""}${chatErr && grpErr ? " | " : ""}${grpErr || ""}`
      );
    }

    return {
      success: true,
      received: chats.length,
      chats_saved: chatRows.length,
      groups_saved: groupRows.length,
    };
  });

export const syncContacts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const candidateId = await resolveTargetCandidate(sb, callerId, data.candidate_id);
    const inst = await getInstanceForUser(sb, candidateId);
    if (!inst.api_key) throw new Error("Instância sem API key");
    const { status, data: res } = await bridge("contacts", {}, { apiKey: inst.api_key });
    if (status >= 400) throw new Error(res?.error || `contacts ${status}`);
    const contacts = Array.isArray(res.contacts) ? res.contacts : [];
    const rows = contacts
      .filter((c: any) => c.id && !c.id.endsWith("@g.us"))
      .map((c: any) => ({
        candidate_id: candidateId,
        jid: c.id,
        name: c.name || c.notify || null,
        push_name: c.pushName || null,
        phone: c.id.split("@")[0] || null,
        last_synced_at: new Date().toISOString(),
      }));
    if (rows.length) {
      await sb.from("whatsapp_contacts").upsert(rows, {
        onConflict: "candidate_id,jid",
      });
    }
    return { success: true, count: rows.length };
  });

export const fetchMessages = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({
      jid: z.string().min(3),
      limit: z.number().int().min(1).max(200).default(50),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const candidateId = await resolveTargetCandidate(sb, callerId, data.candidate_id);
    const inst = await getInstanceForUser(sb, candidateId);
    if (!inst.api_key) throw new Error("Instância sem API key");
    const { status, data: res } = await bridge(
      "fetch_messages",
      { jid: data.jid, limit: data.limit },
      { apiKey: inst.api_key }
    );
    if (status >= 400) {
      const { data: local } = await sb
        .from("whatsapp_messages")
        .select("*")
        .eq("candidate_id", candidateId)
        .eq("jid", data.jid)
        .order("ts", { ascending: true })
        .limit(data.limit);
      return { messages: local || [], source: "cache" as const };
    }
    const msgs = Array.isArray(res?.messages)
      ? res.messages
      : Array.isArray(res)
      ? res
      : [];
    const rows = msgs
      .map((m: any) => {
        const messageId =
          m.key?.id ||
          m.messageId ||
          m.id ||
          `${data.jid}-${JSON.stringify(m.messageTimestamp)}`;
        return {
          candidate_id: candidateId,
          message_id: messageId,
          jid: data.jid,
          from_me: !!(m.key?.fromMe ?? m.fromMe),
          push_name: m.pushName || null,
          message_type: m.messageType || "text",
          text: m.text || m.message?.conversation || null,
          media_url: m.mediaUrl || null,
          media_mime: m.mediaMimeType || null,
          media_filename: m.mediaFileName || null,
          media_size: m.mediaSizeBytes || null,
          ts: tsToIso(m.messageTimestamp) || new Date().toISOString(),
        };
      })
      .filter((r: any) => !!r.message_id);

    let saveErr: string | null = null;
    if (rows.length) {
      const { error } = await sb
        .from("whatsapp_messages")
        .upsert(rows, { onConflict: "candidate_id,message_id" });
      if (error) saveErr = error.message;
    }
    if (saveErr) {
      // Don't throw — still return what we got so the UI can render
      console.error("[fetchMessages] upsert error:", saveErr);
    }
    return { messages: rows, source: "live" as const, saved: rows.length, error: saveErr };
  });


/* ===================== SEND ===================== */

export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({
      jid: z.string().min(3),
      text: z.string().max(4096).optional(),
      media_url: z.string().url().optional(),
      caption: z.string().max(1024).optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const candidateId = await resolveTargetCandidate(sb, callerId, data.candidate_id);
    const inst = await getInstanceForUser(sb, candidateId);
    if (!inst.api_key) throw new Error("Instância sem API key");

    const isGroup = data.jid.endsWith("@g.us");
    const phone = !isGroup
      ? normalizePhoneBR(data.jid.split("@")[0])
      : undefined;

    let payload: Record<string, unknown> = {};
    let action = "send";
    if (data.media_url) {
      action = "send_media";
      payload = {
        media_url: data.media_url,
        caption: data.caption || data.text || "",
      };
    } else {
      payload = { message: data.text || "" };
    }
    if (isGroup) payload.group_jid = data.jid;
    else payload.phone = phone;

    const { status, data: res } = await bridge(action, payload, {
      apiKey: inst.api_key,
    });

    await sb.from("whatsapp_send_log").insert({
      candidate_id: candidateId,
      jid: data.jid,
      status: status < 400 && res?.success ? "sent" : "failed",
    });

    if (status >= 400 || !res?.success) {
      throw new Error(res?.error || `send ${status}`);
    }

    if (res.messageId) {
      await sb
        .from("whatsapp_messages")
        .upsert(
          {
            candidate_id: candidateId,
            message_id: res.messageId,
            jid: data.jid,
            from_me: true,
            message_type: data.media_url ? "image" : "text",
            text: data.text || data.caption || null,
            media_url: data.media_url || null,
            ts: new Date().toISOString(),
          },
          { onConflict: "candidate_id,message_id" }
        );
    }

    return { success: true, messageId: res.messageId };
  });

/* ===================== GROUPS ===================== */

export const toggleGroupFavorite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({ group_id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const { data: g, error } = await sb
      .from("whatsapp_groups")
      .select("id, candidate_id, is_favorite")
      .eq("id", data.group_id)
      .maybeSingle();
    if (error || !g) throw new Error("Grupo não encontrado");
    await resolveTargetCandidate(sb, callerId, g.candidate_id);
    await sb
      .from("whatsapp_groups")
      .update({ is_favorite: !g.is_favorite })
      .eq("id", g.id);
    return { success: true, is_favorite: !g.is_favorite };
  });

/* ===================== OPT-OUTS ===================== */

export const addOptOut = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({
      jid: z.string().min(3),
      reason: z.string().max(200).optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const candidateId = await resolveTargetCandidate(sb, callerId, data.candidate_id);
    await sb
      .from("whatsapp_optouts")
      .upsert(
        { candidate_id: candidateId, jid: data.jid, reason: data.reason || null },
        { onConflict: "candidate_id,jid" }
      );
    return { success: true };
  });

export const removeOptOut = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({ id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const { data: o } = await sb
      .from("whatsapp_optouts")
      .select("id, candidate_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!o) return { success: true };
    await resolveTargetCandidate(sb, callerId, o.candidate_id);
    await sb.from("whatsapp_optouts").delete().eq("id", o.id);
    return { success: true };
  });

/* ===================== BROADCASTS ===================== */

const RecipientSchema = z.object({
  jid: z.string().min(3),
  display_name: z.string().optional().nullable(),
  variables: z.record(z.string(), z.string()).optional(),
});

export const createBroadcast = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({
      name: z.string().min(1).max(150),
      message_text: z.string().min(1).max(4096),
      media_url: z.string().url().optional().nullable(),
      interval_min_seconds: z.number().int().min(15).max(3600),
      interval_max_seconds: z.number().int().min(15).max(3600),
      daily_cap: z.number().int().min(10).max(1000),
      respect_quiet_hours: z.boolean().default(true),
      target_type: z.enum(["contacts", "groups", "leads", "manual_list", "mixed"]),
      recipients: z.array(RecipientSchema).min(1).max(10000),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const candidateId = await resolveTargetCandidate(sb, callerId, data.candidate_id);

    if (data.interval_max_seconds < data.interval_min_seconds) {
      throw new Error("Intervalo máximo deve ser maior que o mínimo");
    }

    const seen = new Set<string>();
    const dedup = data.recipients.filter((r) => {
      if (seen.has(r.jid)) return false;
      seen.add(r.jid);
      return true;
    });

    const { data: bc, error } = await sb
      .from("whatsapp_broadcasts")
      .insert({
        candidate_id: candidateId,
        name: data.name,
        message_text: data.message_text,
        media_url: data.media_url || null,
        interval_min_seconds: data.interval_min_seconds,
        interval_max_seconds: data.interval_max_seconds,
        daily_cap: data.daily_cap,
        respect_quiet_hours: data.respect_quiet_hours,
        target_type: data.target_type,
        total: dedup.length,
        status: "draft",
      })
      .select("id")
      .single();
    if (error || !bc) throw new Error(error?.message || "Falha ao criar campanha");

    const rows = dedup.map((r) => ({
      broadcast_id: bc.id,
      jid: r.jid,
      display_name: r.display_name || null,
      variables: r.variables || {},
      status: "pending" as const,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      await sb
        .from("whatsapp_broadcast_recipients")
        .insert(rows.slice(i, i + 500));
    }

    return { success: true, id: bc.id, total: rows.length };
  });

export const startBroadcast = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({ id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const { data: bc } = await sb
      .from("whatsapp_broadcasts")
      .select("id, candidate_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!bc) throw new Error("Campanha não encontrada");
    await resolveTargetCandidate(sb, callerId, bc.candidate_id);
    await sb
      .from("whatsapp_broadcasts")
      .update({
        status: "running",
        started_at: bc.status === "draft" ? new Date().toISOString() : undefined,
        next_send_at: new Date().toISOString(),
      })
      .eq("id", bc.id);
    return { success: true };
  });

export const pauseBroadcast = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({ id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const { data: bc } = await sb
      .from("whatsapp_broadcasts")
      .select("id, candidate_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!bc) throw new Error("Campanha não encontrada");
    await resolveTargetCandidate(sb, callerId, bc.candidate_id);
    await sb
      .from("whatsapp_broadcasts")
      .update({ status: "paused" })
      .eq("id", bc.id);
    return { success: true };
  });

export const deleteBroadcast = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({ id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data }) => {
    const sb = await userClientFromToken(data.access_token);
    const callerId = await userIdFromToken(data.access_token);
    const { data: bc } = await sb
      .from("whatsapp_broadcasts")
      .select("id, candidate_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!bc) throw new Error("Campanha não encontrada");
    await resolveTargetCandidate(sb, callerId, bc.candidate_id);
    await sb.from("whatsapp_broadcasts").delete().eq("id", bc.id);
    return { success: true };
  });

/* ===================== BROADCAST WORKER ===================== */
/**
 * Process ONE pending recipient per running broadcast (per candidate).
 * Called by pg_cron via /api/public/whatsapp/broadcast-tick every 30s.
 * Uses service role to bypass RLS since no user context exists.
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

/* ===================== ADMIN ===================== */

export const adminListInstances = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ access_token: z.string().min(10) }).parse(input)
  )
  .handler(async ({ data }) => {
    const callerId = await userIdFromToken(data.access_token);
    const supabaseUser = await userClientFromToken(data.access_token);

    const { data: r } = await supabaseUser
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!r) throw new Error("Forbidden");

    const { data: list } = await supabaseUser
      .from("whatsapp_instances")
      .select(
        "id, candidate_id, name, phone_number, status, last_connected_at, daily_cap"
      )
      .order("created_at", { ascending: false });

    const ids = (list || []).map((i) => i.candidate_id);
    const { data: profs } = ids.length
      ? await supabaseUser
          .from("candidate_profiles")
          .select("id, full_name, email")
          .in("id", ids)
      : { data: [] as any[] };
    const profMap = new Map((profs || []).map((p: any) => [p.id, p]));

    const sinceMidnight = new Date();
    sinceMidnight.setHours(0, 0, 0, 0);
    const todaysSent = ids.length
      ? await supabaseUser
          .from("whatsapp_send_log")
          .select("candidate_id")
          .in("candidate_id", ids)
          .eq("status", "sent")
          .gte("created_at", sinceMidnight.toISOString())
      : { data: [] as any[] };
    const sentCounts = new Map<string, number>();
    for (const r of todaysSent.data || []) {
      sentCounts.set(r.candidate_id, (sentCounts.get(r.candidate_id) || 0) + 1);
    }

    return (list || []).map((i) => ({
      ...i,
      candidate: profMap.get(i.candidate_id) || null,
      sent_today: sentCounts.get(i.candidate_id) || 0,
    }));
  });
