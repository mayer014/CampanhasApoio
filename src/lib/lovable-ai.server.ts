// Server-only: cliente do Lovable AI Gateway (OpenAI-compatible).
// Nunca importar do client.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function getActiveAISetting(userId: string, supabaseClient?: any) {
  try {
    const supabase = supabaseClient || (async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseKey) return null;
      return createClient(supabaseUrl, supabaseKey);
    })();

    const client = await supabase;
    if (!client) return null;

    const { data } = await client
      .from('ai_settings')
      .select('provider, model_name, api_key, system_instruction')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    return data;
  } catch (e) {
    console.error("Error fetching AI settings:", e);
    return null;
  }
}

const PROVIDER_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages", // Nota: Anthropic tem formato diferente, requer adapter
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  lovable: GATEWAY_URL
};

export class LovableAIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

export async function chatCompletion(opts: {
  userId: string;
  messages: ChatMessage[];
  model?: string;
  tools?: ToolDef[];
  toolChoice?: { type: "function"; function: { name: string } };
  temperature?: number;
  supabaseClient?: any;
}): Promise<{
  content: string | null;
  toolArgs: Record<string, unknown> | null;
}> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new LovableAIError("LOVABLE_API_KEY não configurada", 500);

  const activeSetting = await getActiveAISetting(opts.userId, opts.supabaseClient);
  
  let url = GATEWAY_URL;
  let authHeader = `Bearer ${process.env.LOVABLE_API_KEY}`;
  let model = opts.model ?? "google/gemini-2.5-flash-lite";

  if (activeSetting) {
    url = PROVIDER_URLS[activeSetting.provider] || GATEWAY_URL;
    authHeader = `Bearer ${activeSetting.api_key}`;
    model = opts.model || activeSetting.model_name;
  }

  const body: Record<string, unknown> = {
    model: model,
    messages: opts.messages,
  };
  
  if (opts.tools) body.tools = opts.tools;
  if (opts.toolChoice) body.tool_choice = opts.toolChoice;
  if (opts.temperature !== undefined) body.temperature = opts.temperature;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      ...(activeSetting?.provider === 'openrouter' ? {
        "HTTP-Referer": "https://fotodeapoio.easychain.com.br",
        "X-Title": "Foto de Apoio"
      } : {})
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) {
      throw new LovableAIError("Limite de requisições da IA atingido. Tente novamente em instantes.", 429);
    }
    if (res.status === 402) {
      throw new LovableAIError("Créditos da IA esgotados. Adicione créditos no workspace.", 402);
    }
    throw new LovableAIError(`AI (${activeSetting?.provider || 'gateway'}) erro ${res.status}: ${text.slice(0, 200)}`, res.status);
  }

  const json = (await res.json()) as any;
  const msg = json.choices?.[0]?.message;
  const tc = msg?.tool_calls?.[0]?.function?.arguments;
  let toolArgs: Record<string, unknown> | null = null;
  if (tc) {
    try {
      toolArgs = JSON.parse(tc);
    } catch {
      toolArgs = null;
    }
  }
  return { content: msg?.content ?? null, toolArgs };
}
