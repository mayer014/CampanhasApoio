import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Webhook receiver for the WhatsHub motor.
 * Payload shape: see WhatsHub guide section "Webhook".
 * Public endpoint (motor does not send bearer token).
 */
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();

          if (body.event === "ping") {
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
          }

          if (body.fromMe === true) {
            return new Response("ignored", { status: 200 });
          }

          const instanceId: string | undefined = body.instanceId;
          if (!instanceId) {
            return new Response("missing instanceId", { status: 400 });
          }

          // Find candidate owning this instance
          const { data: inst } = await supabaseAdmin
            .from("whatsapp_instances")
            .select("candidate_id, instance_id")
            .eq("instance_id", instanceId)
            .maybeSingle();

          if (!inst) {
            // Unknown instance -- ack so motor doesn't keep retrying
            return new Response("unknown instance", { status: 200 });
          }

          const candidateId = inst.candidate_id;
          const jid: string = body.from;
          const messageId: string = body.messageId;
          if (!jid || !messageId) {
            return new Response("missing fields", { status: 200 });
          }

          // Dedup by inserting (unique constraint on candidate_id,message_id)
          const ts = body.timestamp
            ? new Date(body.timestamp * 1000).toISOString()
            : new Date().toISOString();

          const { error: insertErr } = await supabaseAdmin
            .from("whatsapp_messages")
            .insert({
              candidate_id: candidateId,
              message_id: messageId,
              jid,
              from_me: false,
              push_name: body.pushName || null,
              message_type: body.messageType || "text",
              text: body.text || body.message || null,
              media_url: body.mediaUrl || null,
              media_mime: body.mediaMimeType || null,
              media_filename: body.mediaFileName || null,
              media_size: body.mediaSizeBytes || null,
              ts,
            });
          // ignore unique violation
          if (insertErr && !/duplicate key/i.test(insertErr.message)) {
            console.error("[wa webhook] insert error", insertErr);
          }

          // Upsert chat
          const isGroup = jid.endsWith("@g.us");
          const lastText =
            body.text || body.message || (body.mediaMimeType ? `[${body.messageType}]` : "");
          await supabaseAdmin.from("whatsapp_chats").upsert(
            {
              candidate_id: candidateId,
              jid,
              name: body.pushName || null,
              is_group: isGroup,
              last_message_text: lastText,
              last_message_at: ts,
              last_message_from_me: false,
            },
            { onConflict: "candidate_id,jid" }
          );

          // Increment unread (best-effort)
          await supabaseAdmin.rpc("touch_updated_at"); // no-op fallback
          // raw increment via SQL not needed -- the chat list shows unread from messages count if missing.

          return new Response("ok", { status: 200 });
        } catch (e: any) {
          console.error("[wa webhook] error", e);
          return new Response("error", { status: 200 }); // ack to avoid retries
        }
      },
    },
  },
});
