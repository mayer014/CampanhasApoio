// Server functions: análise de sentimento e resumo de comentários sociais.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatCompletion, LovableAIError, type ToolDef } from "./lovable-ai.server";

export type Sentiment = "positive" | "neutral" | "negative";

const ANALYZE_TOOL: ToolDef = {
  type: "function",
  function: {
    name: "classify_comments",
    description: "Classifica uma lista de comentários públicos quanto a sentimento, emoção e tópicos.",
    parameters: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "ID interno do comentário" },
              post_stance: { type: "string", enum: ["denuncia", "conquista", "convite", "opiniao", "neutro"], description: "Postura do post" },
              target: { type: "string", enum: ["candidato", "fato_do_post", "terceiro", "ambiguo"], description: "Alvo do comentário" },
              alignment: { type: "string", enum: ["concorda", "discorda", "neutro"], description: "Alinhamento com o post" },
              sentiment: { type: "string", enum: ["positive", "neutral", "negative"], description: "Sentimento final" },
              confidence: { type: "number", description: "Confiança 0-1" },
              reason: { type: "string", description: "Razão da análise" },
              emotion: {
                type: "string",
                description: "Emoção predominante em uma palavra.",
              },
              topics: {
                type: "array",
                items: { type: "string" },
                description: "1 a 3 tópicos curtos.",
              },
            },
            required: ["id", "sentiment", "post_stance", "target", "alignment", "confidence", "reason", "emotion", "topics"],
            additionalProperties: false,
          },
        },
      },
      required: ["results"],
      additionalProperties: false,
    },
  },
};

const SUMMARY_TOOL: ToolDef = {
  type: "function",
  function: {
    name: "executive_summary",
    description: "Gera um resumo executivo curto da percepção pública.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Parágrafo de 3-5 frases em português, tom analítico." },
        highlights: {
          type: "array",
          items: { type: "string" },
          description: "3-5 bullets curtos com pontos-chave (positivos e negativos).",
        },
        recommendations: {
          type: "array",
          items: { type: "string" },
          description: "2-4 ações sugeridas ao gestor.",
        },
      },
      required: ["summary", "highlights", "recommendations"],
      additionalProperties: false,
    },
  },
};

// -----------------------------------------------------------------------------
// ANALYZE: classifica comentários pendentes em lotes
// -----------------------------------------------------------------------------
export const analyzeSocialComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      batchSize: z.number().min(1).max(50).optional().default(20),
      maxBatches: z.number().min(1).max(10).optional().default(3),
    }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let processed = 0;
    let batches = 0;
    const errors: string[] = [];

    // Busca correções humanas para few-shot
    const { data: corrections } = await supabase
      .from("sentiment_corrections")
      .select("comment_text, post_message, sentiment_human")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    const fewShotExamples = (corrections ?? []).map(c => 
      `Comentário: "${c.comment_text}" | Post: "${c.post_message ?? ''}" -> Sentimento: ${c.sentiment_human}`
    ).join("\n");

    for (let i = 0; i < data.maxBatches; i++) {
      const { data: rows, error } = await supabase
        .from("social_comments")
        .select(`
          id, text, post_external_id, 
          social_posts_cache!inner (caption)
        `)
        .eq("user_id", userId)
        .is("ai_processed_at", null)
        .not("text", "is", null)
        .limit(data.batchSize);
      
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) break;

      const items = rows
        .filter((r) => (r.text ?? "").trim().length > 0)
        .map((r) => ({ 
          id: r.id as string, 
          text: (r.text as string).slice(0, 500),
          post_caption: (r.social_posts_cache as any)?.caption ?? ''
        }));

      if (items.length === 0) {
        await supabase
          .from("social_comments")
          .update({ ai_processed_at: new Date().toISOString() })
          .in("id", rows.map((r) => r.id as string));
        continue;
      }

      try {
        const { toolArgs } = await chatCompletion({
          userId: userId,
          messages: [
            {
              role: "system",
              content: `Você é um analista de mídias sociais brasileiro especializado em política. 
Sua tarefa é classificar comentários. 

REGRAS CRÍTICAS:
- post_stance: postura do post (denuncia | conquista | convite | opiniao | neutro).
- target: alvo do comentário (candidato | fato_do_post | terceiro | ambiguo).
- alignment: concorda | discorda | neutro em relação ao post.
- Se o post é uma DENÚNCIA e o comentário concorda com a denúncia usando palavras fortes ("absurdo", "vergonha"), o sentimento é POSITIVO (apoio ao candidato que denunciou).

EXEMPLOS DE CORREÇÕES HUMANAS:
${fewShotExamples || "Nenhum exemplo disponível."}

Responda SEMPRE via a função classify_comments.`,
            },
            {
              role: "user",
              content: `Classifique os comentários abaixo:\n\n${JSON.stringify(items)}`,
            },
          ],
          tools: [ANALYZE_TOOL],
          toolChoice: { type: "function", function: { name: "classify_comments" } },
          temperature: 0.1,
        });

        const results = (toolArgs?.results as Array<{
          id: string;
          sentiment: Sentiment;
          confidence: number;
          reason: string;
          emotion: string;
          topics: string[];
        }> | undefined) ?? [];

        const now = new Date().toISOString();
        for (const r of results) {
          await supabase
            .from("social_comments")
            .update({
              sentiment: r.sentiment,
              sentiment_source: 'ai',
              sentiment_confidence: r.confidence,
              sentiment_reason: r.reason,
              needs_review: r.confidence < 0.7,
              emotion: r.emotion?.slice(0, 50) ?? null,
              topics: (r.topics ?? []).slice(0, 5).map((t: string) => t.slice(0, 50)),
              ai_processed_at: now,
            })
            .eq("id", r.id)
            .eq("user_id", userId);
          processed++;
        }
        // marca também os não retornados pra evitar loop
        const returnedIds = new Set(results.map((r) => r.id));
        const missing = items.filter((it) => !returnedIds.has(it.id)).map((it) => it.id);
        if (missing.length > 0) {
          await supabase
            .from("social_comments")
            .update({ ai_processed_at: now })
            .in("id", missing)
            .eq("user_id", userId);
        }
        batches++;
      } catch (e) {
        const msg = e instanceof LovableAIError ? e.message : e instanceof Error ? e.message : "erro IA";
        errors.push(msg);
        // se for 429/402, para
        if (e instanceof LovableAIError && (e.status === 429 || e.status === 402)) break;
      }
    }

    return { processed, batches, errors };
  });

// -----------------------------------------------------------------------------
// SUMMARY: estatísticas + resumo executivo
// -----------------------------------------------------------------------------
export const getSentimentSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      days: z.number().min(1).max(90).optional().default(7),
      includeExecutive: z.boolean().optional().default(false),
    }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();

    const { data: rows, error } = await supabase
      .from("social_comments")
      .select("sentiment, emotion, topics, text, posted_at")
      .eq("user_id", userId)
      .gte("posted_at", since)
      .not("sentiment", "is", null);
    if (error) throw new Error(error.message);

    const stats = { positive: 0, neutral: 0, negative: 0, total: 0 };
    const topicCount = new Map<string, number>();
    const emotionCount = new Map<string, number>();
    for (const r of rows ?? []) {
      const s = (r as { sentiment: Sentiment }).sentiment;
      stats[s]++;
      stats.total++;
      for (const t of ((r as { topics: string[] | null }).topics ?? [])) {
        const k = t.toLowerCase().trim();
        if (k) topicCount.set(k, (topicCount.get(k) ?? 0) + 1);
      }
      const em = (r as { emotion: string | null }).emotion;
      if (em) {
        const k = em.toLowerCase().trim();
        emotionCount.set(k, (emotionCount.get(k) ?? 0) + 1);
      }
    }
    const topTopics = Array.from(topicCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([topic, count]) => ({ topic, count }));
    const topEmotions = Array.from(emotionCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emotion, count]) => ({ emotion, count }));

    let executive: {
      summary: string;
      highlights: string[];
      recommendations: string[];
    } | null = null;

    if (data.includeExecutive && stats.total >= 3) {
      // amostra balanceada
      const sample = (rows ?? [])
        .slice(0, 60)
        .map((r) => ({
          s: (r as { sentiment: Sentiment }).sentiment,
          t: ((r as { text: string | null }).text ?? "").slice(0, 240),
        }))
        .filter((x) => x.t.length > 0);
      try {
        const { toolArgs } = await chatCompletion({
          userId: userId,
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Você é um analista político/de marca brasileiro. Gere um diagnóstico curto, prático e honesto sobre a percepção pública, baseado em uma amostra de comentários.",
            },
            {
              role: "user",
              content: `Estatísticas dos últimos ${data.days} dias: ${JSON.stringify(stats)}.\nTópicos: ${JSON.stringify(topTopics)}.\nEmoções: ${JSON.stringify(topEmotions)}.\nAmostra: ${JSON.stringify(sample)}.\n\nGere o resumo via a função executive_summary.`,
            },
          ],
          tools: [SUMMARY_TOOL],
          toolChoice: { type: "function", function: { name: "executive_summary" } },
          temperature: 0.4,
        });
        if (toolArgs) {
          executive = {
            summary: String(toolArgs.summary ?? ""),
            highlights: Array.isArray(toolArgs.highlights) ? toolArgs.highlights as string[] : [],
            recommendations: Array.isArray(toolArgs.recommendations) ? toolArgs.recommendations as string[] : [],
          };
        }
      } catch (e) {
        // resumo é opcional, não derruba a chamada
        console.error("executive summary error", e);
      }
    }

    return { stats, topTopics, topEmotions, executive, days: data.days };
  });

export const correctSentiment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      commentId: z.string().uuid(),
      humanSentiment: z.enum(["positive", "neutral", "negative"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Busca o comentário original para logar o que o humano corrigiu
    const { data: c } = await supabase
      .from("social_comments")
      .select("text, sentiment, post_external_id")
      .eq("id", data.commentId)
      .single();

    if (!c) throw new Error("Comentário não encontrado");

    // Busca o post para contexto
    const { data: post } = await supabase
      .from("social_posts_cache")
      .select("caption")
      .eq("external_id", c.post_external_id)
      .maybeSingle();

    // Registra a correção para o few-shot
    await supabase.from("sentiment_corrections").insert({
      user_id: userId,
      comment_text: c.text ?? '',
      post_message: post?.caption,
      sentiment_ai: c.sentiment,
      sentiment_human: data.humanSentiment,
    });

    // Atualiza o comentário
    await supabase.from("social_comments").update({
      sentiment: data.humanSentiment,
      sentiment_source: 'human',
      ai_processed_at: new Date().toISOString(), // Marca como processado
    }).eq("id", data.commentId);

    return { ok: true };
  });
