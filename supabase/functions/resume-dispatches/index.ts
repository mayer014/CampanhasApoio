
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Find dispatches that should be resumed
    // (pausado_timeout, pausado_janela, enfileirado)
    const { data: pending } = await supabase
      .from("whatsapp_dispatches")
      .select("id")
      .in("status", ["enfileirado", "pausado_timeout", "pausado_janela"])
      .order("created_at", { ascending: true })
      .limit(1);

    if (pending && pending.length > 0) {
      // 2. Trigger the processor edge function for the next one
      // In a real scenario, this would call send-whatsapp-dispatch with a special action
      console.log(`Resuming dispatch ${pending[0].id}`);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
