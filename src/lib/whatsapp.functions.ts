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
      { master: true, accessToken: data.access_token }
    );
    if (status >= 400 || res?.error) {
      throw new Error(res?.error || `Bridge create_instance failed (${status})`);
    }

    const apiKey = (res?.api_key ?? res?.apiKey) as string | undefined;
    const instanceId = (res?.instance?.id ?? res?.instance?.instance_id) as string | undefined;
    const phone = (res?.instance?.phone_number ?? res?.phone_number) || null;
    const remoteStatus =
      (res?.instance?.status as "connected" | "connecting" | "disconnected") ||
      "connecting";
    const qrcode = (res?.qrcode ?? res?.instance?.qrcode) as string | undefined;


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
    if (status === 401 || status === 403 || status === 404 || res?.error?.toLowerCase().includes("api key") || res?.error?.toLowerCase().includes("not found")) {
      await sb.from("whatsapp_instances").update({ api_key: null, status: "disconnected", instance_id: null }).eq("candidate_id", candidateId);
      throw new Error("Conexão expirada ou instância não encontrada. Por favor, inicie uma nova conexão.");
    }
    if (status >= 400) {
      return {
        configured: true as const,
        status: "disconnected" as const,
        qrcode: null,
        phone_number: inst.phone_number,
        error: res?.error || `status ${status}`,
      };
    }
    let newStatus = (res.status || "disconnected") as
      | "connected"
      | "connecting"
      | "disconnected";

    // Se temos um QR Code, para o nosso frontend o status deve ser 'connecting'
    // para que a interface continue exibindo o QR Code e permitindo o scan.
    if (res.qrcode && newStatus === "disconnected") {
      newStatus = "connecting";
    }
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
    
    // If we have an API key, we call reconnect. If it fails with 401/403 (Invalid API Key), 
    // we should probably allow the user to create a new one.
    if (!inst.api_key) throw new Error("Instância sem API key");
    
    const { status, data: res } = await bridge("reconnect", {}, { apiKey: inst.api_key });
    
    if (status === 401 || status === 403 || status === 404 || res?.error?.toLowerCase().includes("api key") || res?.error?.toLowerCase().includes("not found")) {
      // If the API key is invalid or instance not found, we clear it so the user can "Create New"
      await sb.from("whatsapp_instances").update({ api_key: null, status: "disconnected", instance_id: null }).eq("candidate_id", candidateId);
      throw new Error("Instância inválida ou não encontrada. O sistema foi resetado, tente conectar novamente.");
    }
    
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
      media_urls: z.array(z.string().url()).max(10).optional(),
      interval_min_seconds: z.number().int().min(15).max(3600),
      interval_max_seconds: z.number().int().min(15).max(3600),
      daily_cap: z.number().int().min(10).max(1000),
      hour_cap: z.number().int().min(5).max(500).optional(),
      respect_quiet_hours: z.boolean().default(true),
      allowed_weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
      daytime_windows: z
        .array(
          z.object({
            start: z.string().regex(/^\d{2}:\d{2}$/),
            end: z.string().regex(/^\d{2}:\d{2}$/),
          })
        )
        .max(4)
        .optional(),
      simulate_typing: z.boolean().optional(),
      long_pause_every: z.number().int().min(0).max(500).optional(),
      long_pause_seconds_min: z.number().int().min(30).max(7200).optional(),
      long_pause_seconds_max: z.number().int().min(30).max(7200).optional(),
      recipient_cooldown_hours: z.number().int().min(0).max(720).optional(),
      append_optout_footer: z.boolean().optional(),
      shuffle_recipients: z.boolean().optional(),
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
    if (
      data.long_pause_seconds_min != null &&
      data.long_pause_seconds_max != null &&
      data.long_pause_seconds_max < data.long_pause_seconds_min
    ) {
      throw new Error("Pausa longa: máximo deve ser maior que o mínimo");
    }

    const seen = new Set<string>();
    const dedup = data.recipients.filter((r) => {
      if (seen.has(r.jid)) return false;
      seen.add(r.jid);
      return true;
    });

    const insertPayload: Record<string, unknown> = {
      candidate_id: candidateId,
      name: data.name,
      message_text: data.message_text,
      media_url: data.media_url || null,
      media_urls: data.media_urls && data.media_urls.length > 0 ? data.media_urls : [],
      interval_min_seconds: data.interval_min_seconds,
      interval_max_seconds: data.interval_max_seconds,
      daily_cap: data.daily_cap,
      respect_quiet_hours: data.respect_quiet_hours,
      target_type: data.target_type,
      total: dedup.length,
      status: "draft",
    };
    if (data.hour_cap != null) insertPayload.hour_cap = data.hour_cap;
    if (data.allowed_weekdays) insertPayload.allowed_weekdays = data.allowed_weekdays;
    if (data.daytime_windows) insertPayload.daytime_windows = data.daytime_windows;
    if (data.simulate_typing != null) insertPayload.simulate_typing = data.simulate_typing;
    if (data.long_pause_every != null) insertPayload.long_pause_every = data.long_pause_every;
    if (data.long_pause_seconds_min != null) insertPayload.long_pause_seconds_min = data.long_pause_seconds_min;
    if (data.long_pause_seconds_max != null) insertPayload.long_pause_seconds_max = data.long_pause_seconds_max;
    if (data.recipient_cooldown_hours != null) insertPayload.recipient_cooldown_hours = data.recipient_cooldown_hours;
    if (data.append_optout_footer != null) insertPayload.append_optout_footer = data.append_optout_footer;
    if (data.shuffle_recipients != null) insertPayload.shuffle_recipients = data.shuffle_recipients;

    const { data: bc, error } = await sb
      .from("whatsapp_broadcasts")
      .insert(insertPayload as any)
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

/* Broadcast worker moved to whatsapp.server.ts (tickBroadcastsInternal). */

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
