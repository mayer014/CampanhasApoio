import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, validateUser, checkClientAccess } from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const user = await validateUser(req, supabase);
    const body = await req.json();
    const { action, client_id } = body;

    await checkClientAccess(supabase, user.id, client_id);

    if (action === "promote_queue") {
      // Logic to promote next in queue
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Default action: Create dispatch
    const { 
      titulo, mensagem, media_url, tipo, 
      batch_size = 20, delay_min = 5, delay_max = 15, batch_pause = 60,
      filters = {} 
    } = body;

    // 1. Create dispatch record
    const { data: dispatch, error: dErr } = await supabase
      .from("whatsapp_dispatches")
      .insert({
        client_id,
        title: titulo,
        message: mensagem,
        media_url,
        type: tipo,
        filters,
        batch_size,
        delay_min,
        delay_max,
        batch_pause,
        status: 'pendente'
      })
      .select()
      .single();

    if (dErr) throw dErr;

    // 2. Resolve recipients
    let recipients: { name: string; phone: string }[] = [];

    if (tipo === "todos") {
      const { data } = await supabase.from("voter_leads").select("full_name, phone").eq("candidate_id", client_id);
      recipients = (data || []).map(r => ({ name: r.full_name, phone: r.phone }));
    } else if (tipo === "tags" && filters.tag_filtro) {
      // Simplified: search in voter_leads where tags contain tag_filtro
      const { data } = await supabase.from("voter_leads").select("full_name, phone").eq("candidate_id", client_id);
      recipients = (data || []).map(r => ({ name: r.full_name, phone: r.phone }));
    } else if (tipo === "manual_list" && Array.isArray(filters.recipients)) {
      recipients = filters.recipients;
    }

    if (recipients.length > 0) {
      const items = recipients.map(r => ({
        dispatch_id: dispatch.id,
        contact_name: r.name,
        contact_phone: r.phone,
        status: 'pendente'
      }));

      const { error: iErr } = await supabase.from("whatsapp_dispatch_items").insert(items);
      if (iErr) throw iErr;

      await supabase.from("whatsapp_dispatches").update({ 
        total_count: recipients.length,
        status: 'enfileirado' 
      }).eq("id", dispatch.id);
    } else {
      await supabase.from("whatsapp_dispatches").update({ status: 'concluido' }).eq("id", dispatch.id);
    }

    return new Response(JSON.stringify({ dispatch_id: dispatch.id, queued: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
