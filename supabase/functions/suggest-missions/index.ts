
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, validateUser, checkClientAccess } from "../_shared/utils.ts";

const LOVABLE_AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovApiKey) throw new Error("LOVABLE_API_KEY not set");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const user = await validateUser(req, supabase);
    
    const { themes, commentSamples, clientId } = await req.json();
    await checkClientAccess(supabase, user.id, clientId);

    const systemPrompt = `Você é um estrategista político digital brasileiro. 
Sugira missões simples de engajamento (comentar, compartilhar, reagir, criar conteúdo) ligadas aos temas em alta.
As missões devem ser práticas e incentivar o apoio ao candidato.

TEMAS EM ALTA:
${JSON.stringify(themes)}

AMOSTRA DE COMENTÁRIOS:
${JSON.stringify(commentSamples)}

Retorne APENAS um JSON estrito no formato:
{ 
  "suggestions": [
    { 
      "title": "Título curto", 
      "description": "Descrição clara do que o apoiador deve fazer", 
      "theme": "Tema relacionado", 
      "platform": "facebook|instagram|ambos", 
      "priority": "alta|media|baixa" 
    }
  ] 
}`;

    const response = await fetch(LOVABLE_AI_GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Gere 3 a 5 sugestões de missões baseadas nos dados fornecidos." }
        ],
        temperature: 0.7,
      }),
    });

    const aiData = await response.json();
    let content = aiData.choices[0].message.content;
    
    // Clean code fences
    content = content.replace(/```json\n?|```/g, "").trim();
    
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
