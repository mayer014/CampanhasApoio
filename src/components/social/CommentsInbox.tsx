import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  MessageSquare, Instagram, Facebook, RefreshCw, Send, EyeOff, Check,
  ExternalLink, AlertTriangle, Filter, Reply, RotateCcw, Smile, Meh, Frown,
} from "lucide-react";
import {
  listSocialComments,
  syncMetaComments,
  replySocialComment,
  updateCommentStatus,
  type CommentPlatform,
  type CommentStatus,
  type SocialCommentRow,
} from "@/lib/meta-comments.functions";

type SentimentFilter = "all" | "positive" | "neutral" | "negative";

const SENTIMENT_META: Record<"positive" | "neutral" | "negative", { icon: typeof Smile; cls: string; label: string }> = {
  positive: { icon: Smile, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", label: "Positivo" },
  neutral: { icon: Meh, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30", label: "Neutro" },
  negative: { icon: Frown, cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30", label: "Negativo" },
};

const STATUS_LABEL: Record<CommentStatus, string> = {
  pending: "Pendentes",
  replied: "Respondidos",
  handled: "Tratados",
  hidden: "Ocultos",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function CommentItem({ c, onChange }: { c: SocialCommentRow; onChange: () => void }) {
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const reply = useServerFn(replySocialComment);
  const updateStatus = useServerFn(updateCommentStatus);

  const replyMut = useMutation({
    mutationFn: () => reply({ data: { commentId: c.id, message: draft.trim() } }),
    onSuccess: () => {
      toast.success("Resposta enviada!");
      setReplying(false);
      setDraft("");
      onChange();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao responder"),
  });

  const statusMut = useMutation({
    mutationFn: (s: CommentStatus) =>
      updateStatus({ data: { commentId: c.id, status: s, hideOnPlatform: s === "hidden" } }),
    onSuccess: () => onChange(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const PlatformIcon = c.platform === "instagram" ? Instagram : Facebook;
  const platformColor = c.platform === "instagram" ? "text-[#d62976]" : "text-[#1877F2]";

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex gap-3">
        {c.post?.thumbnail_url ? (
          <img src={c.post.thumbnail_url} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted">
            <PlatformIcon className={`h-5 w-5 ${platformColor}`} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <PlatformIcon className={`h-3.5 w-3.5 ${platformColor}`} />
            <span
              className="font-semibold"
              title={
                !c.author_name && c.platform === "facebook"
                  ? "O Facebook oculta o nome de quem comenta a menos que a pessoa seja administradora da Página ou tenha autorizado o app. É uma restrição da Meta, não um bug."
                  : undefined
              }
            >
              {c.author_name ??
                (c.platform === "facebook" ? "Usuário do Facebook" : "Anônimo")}
            </span>
            <span className="text-muted-foreground">· {timeAgo(c.posted_at)}</span>
            {c.status !== "pending" && (
              <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[c.status]}</Badge>
            )}

            {c.sentiment && (() => {
              const sm = SENTIMENT_META[c.sentiment as keyof typeof SENTIMENT_META];
              if (!sm) return null;
              const Icon = sm.icon;
              return (
                <Badge variant="outline" className={`gap-1 text-[10px] ${sm.cls}`}>
                  <Icon className="h-3 w-3" /> {sm.label}
                </Badge>
              );
            })()}
            {c.emotion && (
              <span className="text-[10px] italic text-muted-foreground">· {c.emotion}</span>
            )}
            {c.post?.permalink && (
              <a href={c.post.permalink} target="_blank" rel="noreferrer"
                 className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-3 w-3" /> post
              </a>
            )}
          </div>
          <p className="mt-1.5 text-sm">{c.text ?? "(sem texto)"}</p>
          {c.topics && c.topics.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {c.topics.map((t) => (
                <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  #{t}
                </span>
              ))}
            </div>
          )}
          {c.reply_text && (
            <div className="mt-2 rounded-md border-l-2 border-primary bg-muted/40 p-2 text-xs">
              <p className="font-medium text-muted-foreground">Sua resposta · {timeAgo(c.replied_at)}</p>
              <p className="mt-0.5">{c.reply_text}</p>
            </div>
          )}

          {replying ? (
            <div className="mt-3 space-y-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escreva uma resposta cordial e objetiva…"
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={!draft.trim() || replyMut.isPending}
                        onClick={() => replyMut.mutate()}>
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  {replyMut.isPending ? "Enviando…" : "Enviar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setReplying(false); setDraft(""); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.status !== "replied" && (
                <Button size="sm" variant="outline" onClick={() => setReplying(true)}>
                  <Reply className="mr-1 h-3.5 w-3.5" /> Responder
                </Button>
              )}
              {c.status !== "handled" && (
                <Button size="sm" variant="ghost" onClick={() => statusMut.mutate("handled")}>
                  <Check className="mr-1 h-3.5 w-3.5" /> Marcar tratado
                </Button>
              )}
              {c.status !== "hidden" ? (
                <Button size="sm" variant="ghost" className="text-destructive"
                        onClick={() => statusMut.mutate("hidden")}>
                  <EyeOff className="mr-1 h-3.5 w-3.5" /> Ocultar
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => statusMut.mutate("pending")}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restaurar
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CommentsInbox() {
  const qc = useQueryClient();
  const list = useServerFn(listSocialComments);
  const sync = useServerFn(syncMetaComments);

  const [status, setStatus] = useState<CommentStatus | "all">("pending");
  const [platform, setPlatform] = useState<CommentPlatform | "all">("all");
  const [sentiment, setSentiment] = useState<SentimentFilter>("all");

  const query = useQuery({
    queryKey: ["social-comments", status, platform, sentiment],
    queryFn: () => list({
      data: {
        status: status === "all" ? undefined : status,
        platform: platform === "all" ? undefined : platform,
        sentiment: sentiment === "all" ? undefined : sentiment,
      },
    }),
    staleTime: 30_000,
  });

  const syncMut = useMutation({
    mutationFn: () => sync({ data: { postLimit: 5 } }),
    onSuccess: (r) => {
      if (r.commentsSynced === 0 && r.warnings.length > 0) {
        toast.warning(`Sincronizado, mas nenhum comentário novo. Avisos: ${r.warnings.slice(0, 2).join(" | ")}`);
      } else if (r.commentsSynced === 0) {
        toast.info(`Sincronizado: nenhum comentário novo em ${r.postsSynced} post(s).`);
      } else {
        toast.success(`Sincronizado: ${r.commentsSynced} comentário(s) em ${r.postsSynced} post(s).`);
      }
      if (r.warnings.length > 0) console.warn("sync warnings", r.warnings);
      qc.invalidateQueries({ queryKey: ["social-comments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao sincronizar"),
  });


  const counts = query.data?.counts;
  const comments = query.data?.comments ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary"><MessageSquare className="h-5 w-5" /></div>
            <div>
              <CardTitle className="text-base">Central de Comentários</CardTitle>
              <CardDescription>Inbox unificado do Instagram e Facebook</CardDescription>
            </div>
          </div>
          <Button onClick={() => syncMut.mutate()} disabled={syncMut.isPending} size="sm">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncMut.isPending ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={status} onValueChange={(v) => setStatus(v as CommentStatus | "all")}>
            <TabsList>
              <TabsTrigger value="pending">
                Pendentes {counts && counts.pending > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{counts.pending}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="replied">Respondidos</TabsTrigger>
              <TabsTrigger value="handled">Tratados</TabsTrigger>
              <TabsTrigger value="hidden">Ocultos</TabsTrigger>
              <TabsTrigger value="all">Todos</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Tabs value={platform} onValueChange={(v) => setPlatform(v as CommentPlatform | "all")}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
                <TabsTrigger value="instagram" className="text-xs"><Instagram className="h-3 w-3" /></TabsTrigger>
                <TabsTrigger value="facebook" className="text-xs"><Facebook className="h-3 w-3" /></TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={sentiment} onValueChange={(v) => setSentiment(v as SentimentFilter)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
                <TabsTrigger value="positive" className="text-xs text-emerald-600"><Smile className="h-3 w-3" /></TabsTrigger>
                <TabsTrigger value="neutral" className="text-xs text-amber-600"><Meh className="h-3 w-3" /></TabsTrigger>
                <TabsTrigger value="negative" className="text-xs text-rose-600"><Frown className="h-3 w-3" /></TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {query.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : query.isError ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <p>{query.error instanceof Error ? query.error.message : "Erro ao carregar"}</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
            Nenhum comentário {status !== "all" ? STATUS_LABEL[status as CommentStatus].toLowerCase() : ""}.
            <br />
            Clique em <strong>Sincronizar</strong> para buscar os mais recentes.
          </div>
        ) : (
          <div className="space-y-2">
            {comments.map((c) => (
              <CommentItem key={c.id} c={c} onChange={() => qc.invalidateQueries({ queryKey: ["social-comments"] })} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
