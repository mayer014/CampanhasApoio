
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

    if (action === "check_bridge") {
      // Mock check: in a real scenario, we would call the bridge API
      const { data: profile } = await supabase
        .from("candidate_profiles")
        .select("phone")
        .eq("id", client_id)
        .single();
      
      const isConnected = !!profile?.phone; // Simple logic for mock

      return new Response(JSON.stringify({ 
        status: isConnected ? "connected" : "disconnected",
        details: isConnected ? "Ponte ativa e pronta para disparos." : "Instância não configurada ou desconectada."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
