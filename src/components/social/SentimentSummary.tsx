import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Smile, Meh, Frown, TrendingUp, Lightbulb, BrainCircuit } from "lucide-react";
import { getSentimentSummary } from "@/lib/social-ai.functions";
import { analyzeSocialComments } from "@/lib/social-ai.functions";
import { toast } from "sonner";

export function SentimentSummary() {
  const summaryFn = useServerFn(getSentimentSummary);
  const analyzeFn = useServerFn(analyzeSocialComments);
  const [days] = useState(7);

  const summary = useQuery({
    queryKey: ["sentiment-summary", days],
    queryFn: () => summaryFn({ data: { days, includeExecutive: false } }),
    staleTime: 60_000,
  });

  const executive = useMutation({
    mutationFn: () => summaryFn({ data: { days, includeExecutive: true } }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao gerar resumo"),
  });

  const analyze = useMutation({
    mutationFn: () => analyzeFn({ data: { batchSize: 20, maxBatches: 3 } }),
    onSuccess: (r) => {
      toast.success(`IA processou ${r.processed} comentários`);
      void summary.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro na IA"),
  });

  const stats = summary.data?.stats;
  const total = stats?.total ?? 0;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary"><BrainCircuit className="h-5 w-5" /></div>
            <div>
              <CardTitle className="text-base">Análise de Sentimento (IA)</CardTitle>
              <CardDescription>Últimos {days} dias · {total} comentários analisados</CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => analyze.mutate()} disabled={analyze.isPending}>
              <Sparkles className={`mr-1.5 h-3.5 w-3.5 ${analyze.isPending ? "animate-pulse" : ""}`} />
              {analyze.isPending ? "Analisando…" : "Analisar pendentes"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem dados ainda. Sincronize comentários e clique em <strong>Analisar pendentes</strong> para usar a IA.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <SentimentCard icon={Smile} label="Positivo" value={stats!.positive} pct={pct(stats!.positive)} tone="positive" />
              <SentimentCard icon={Meh} label="Neutro" value={stats!.neutral} pct={pct(stats!.neutral)} tone="neutral" />
              <SentimentCard icon={Frown} label="Negativo" value={stats!.negative} pct={pct(stats!.negative)} tone="negative" />
            </div>

            {(summary.data?.topTopics?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> Tópicos recorrentes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {summary.data!.topTopics.map((t) => (
                    <Badge key={t.topic} variant="secondary" className="text-xs">
                      {t.topic} <span className="ml-1 opacity-60">·{t.count}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              {executive.data?.executive ? (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="leading-relaxed">{executive.data.executive.summary}</p>
                  {executive.data.executive.highlights.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                      {executive.data.executive.highlights.map((h, i) => <li key={i}>{h}</li>)}
                    </ul>
                  )}
                  {executive.data.executive.recommendations.length > 0 && (
                    <div className="border-t pt-2">
                      <p className="text-xs font-medium flex items-center gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> Ações sugeridas</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                        {executive.data.executive.recommendations.map((h, i) => <li key={i}>{h}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => executive.mutate()} disabled={executive.isPending}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  {executive.isPending ? "Gerando resumo executivo…" : "Gerar resumo executivo com IA"}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SentimentCard({
  icon: Icon, label, value, pct, tone,
}: {
  icon: typeof Smile;
  label: string;
  value: number;
  pct: number;
  tone: "positive" | "neutral" | "negative";
}) {
  const toneCls = {
    positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    neutral: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    negative: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  }[tone];
  return (
    <div className="rounded-xl border p-3">
      <div className={`mb-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${toneCls}`}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="text-2xl font-bold">{pct}%</p>
      <p className="text-xs text-muted-foreground">{value} comentários</p>
    </div>
  );
}
