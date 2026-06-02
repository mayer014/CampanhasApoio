import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  listMetaConnectionsForDiag,
  getMetaAppInfo,
  getMetaDiagSample,
} from "@/lib/meta-diag.functions";

export const Route = createFileRoute("/admin/diag-meta")({
  component: DiagMetaPage,
});

type ConnItem = {
  id: string;
  page_id: string | null;
  page_name: string | null;
  instagram_username: string | null;
  status: string | null;
  candidate: { full_name: string; email: string } | null;
};

function DiagMetaPage() {
  const listFn = useServerFn(listMetaConnectionsForDiag);
  const appFn = useServerFn(getMetaAppInfo);
  const sampleFn = useServerFn(getMetaDiagSample);

  const [conns, setConns] = useState<ConnItem[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [appInfo, setAppInfo] = useState<Awaited<ReturnType<typeof getMetaAppInfo>> | null>(null);
  const [sample, setSample] = useState<Awaited<ReturnType<typeof getMetaDiagSample>> | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);

  useEffect(() => {
    listFn({ data: undefined as never }).then((r) => setConns(r as ConnItem[])).catch((e) => toast.error(e.message));
  }, []);

  const loadInfo = async (id: string) => {
    setSelected(id);
    setAppInfo(null);
    setSample(null);
    setLoadingInfo(true);
    try {
      const r = await appFn({ data: { connectionId: id } });
      setAppInfo(r);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingInfo(false);
    }
  };

  const loadSample = async (rehydrate: boolean) => {
    if (!selected) return;
    setLoadingSample(true);
    try {
      const r = await sampleFn({ data: { connectionId: selected, rehydrate } });
      setSample(r);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingSample(false);
    }
  };

  const diagnosis = (() => {
    if (!appInfo || !sample) return null;
    const hasReadUser = appInfo.debug.scope_status.find((s) => s.scope === "pages_read_user_content")?.granted;
    const pct = sample.pct_with_name;
    if (!hasReadUser) {
      return {
        level: "error" as const,
        title: "Escopo pages_read_user_content AUSENTE",
        text: "É necessário submeter App Review para esse escopo. Sem ele a Meta nunca devolve from.name de comentários de terceiros.",
      };
    }
    if (pct >= 90) {
      return { level: "ok" as const, title: "Tudo funcionando", text: `${pct}% dos comentários vêm com nome — provável bug era cache antigo.` };
    }
    if (pct < 50) {
      return {
        level: "warn" as const,
        title: "Permissão OK, mas <50% com nome",
        text: "Limitação de privacidade da Meta (usuários sem perfil público / não autorizaram o app). Solução: fallback 'Usuário do Facebook' no inbox.",
      };
    }
    return { level: "warn" as const, title: `${pct}% com nome`, text: "Permissão OK. Restante é privacidade dos usuários." };
  })();

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
        <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" /> Ferramenta interna de diagnóstico — não divulgar para clientes
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Diagnóstico Meta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Descobrir por que `from.name` não vem em comentários do Facebook.
        </p>
      </div>

      <Card className="p-4">
        <label className="text-sm font-medium">Conexão</label>
        <Select value={selected} onValueChange={loadInfo}>
          <SelectTrigger className="mt-2"><SelectValue placeholder="Escolha uma conexão Meta…" /></SelectTrigger>
          <SelectContent>
            {conns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.candidate?.full_name ?? "—"} · {c.page_name ?? c.page_id ?? "(sem página)"} · {c.status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {loadingInfo && <Card className="p-6 text-center text-muted-foreground">Carregando…</Card>}

      {appInfo && (
        <>
          <Card className="p-4">
            <h2 className="text-lg font-semibold">1. Status do App Meta</h2>
            {appInfo.app.error ? (
              <p className="mt-2 text-sm text-destructive">Erro: {appInfo.app.error}</p>
            ) : (
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">App ID</dt><dd className="font-mono">{appInfo.app.info?.id}</dd>
                <dt className="text-muted-foreground">Nome</dt><dd>{appInfo.app.info?.name}</dd>
                <dt className="text-muted-foreground">Namespace</dt><dd>{appInfo.app.info?.namespace || "—"}</dd>
              </dl>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              ⚠️ O modo Live/Development não é exposto pela Graph API sem app token; confirme em developers.facebook.com → seu app → topo da página.
            </p>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-semibold">2. Token &amp; Escopos</h2>
            {appInfo.debug.error && (
              <p className="mt-2 text-sm text-destructive">Erro: {appInfo.debug.error}</p>
            )}
            {appInfo.debug.data && (
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">Tipo</dt><dd className="font-mono">{appInfo.debug.token_kind}</dd>
                <dt className="text-muted-foreground">App associado</dt><dd className="font-mono">{appInfo.debug.data.application}</dd>
                <dt className="text-muted-foreground">Profile ID (page)</dt><dd className="font-mono">{appInfo.debug.data.profile_id ?? "—"}</dd>
                <dt className="text-muted-foreground">User ID</dt><dd className="font-mono">{appInfo.debug.data.user_id ?? "—"}</dd>
                <dt className="text-muted-foreground">Válido</dt>
                <dd>{appInfo.debug.data.is_valid ? <span className="text-green-600">sim</span> : <span className="text-destructive">não</span>}</dd>
                <dt className="text-muted-foreground">Expira em</dt>
                <dd>{appInfo.debug.data.expires_at ? new Date(appInfo.debug.data.expires_at * 1000).toLocaleString() : "—"}</dd>
              </dl>
            )}

            <h3 className="mt-4 text-sm font-semibold">Escopos críticos</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {appInfo.debug.scope_status.map((s) => (
                <Badge key={s.scope} variant={s.granted ? "default" : "destructive"} className="font-mono text-xs">
                  {s.granted ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                  {s.scope}
                </Badge>
              ))}
            </div>

            {appInfo.debug.all_scopes.length > 0 && (
              <details className="mt-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Todos os escopos concedidos ({appInfo.debug.all_scopes.length})</summary>
                <pre className="mt-2 overflow-auto rounded bg-muted p-2">{appInfo.debug.all_scopes.join("\n")}</pre>
              </details>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">3. Amostra real de comentários</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => loadSample(false)} disabled={loadingSample}>
                  <RefreshCw className="mr-1.5 h-3 w-3" /> Buscar amostra
                </Button>
                <Button size="sm" onClick={() => loadSample(true)} disabled={loadingSample}>
                  Buscar + re-hidratar individualmente
                </Button>
              </div>
            </div>

            {loadingSample && <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>}

            {sample && (
              <>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <Stat label="Posts" value={sample.posts_scanned} />
                  <Stat label="Comentários" value={sample.total_comments} />
                  <Stat
                    label="% com nome"
                    value={`${sample.pct_with_name}%`}
                    tone={sample.pct_with_name >= 90 ? "ok" : sample.pct_with_name >= 50 ? "warn" : "bad"}
                  />
                </div>

                <div className="mt-4 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="p-2">Autor</th>
                        <th className="p-2">Author ID</th>
                        <th className="p-2">Mensagem</th>
                        <th className="p-2">Comment ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sample.rows.map((r) => (
                        <tr key={r.comment_id} className="border-t">
                          <td className="p-2">
                            {r.author_name ? (
                              <span className={r.hydrated ? "text-amber-600" : ""}>{r.author_name}{r.hydrated && " *"}</span>
                            ) : (
                              <span className="text-destructive">— sem nome —</span>
                            )}
                          </td>
                          <td className="p-2 font-mono">{r.author_id ?? "—"}</td>
                          <td className="p-2 max-w-md truncate">{r.message}</td>
                          <td className="p-2 font-mono text-muted-foreground">{r.comment_id.slice(-12)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sample.rows.length === 0 && <p className="p-4 text-center text-muted-foreground">Nenhum comentário encontrado.</p>}
                  <p className="mt-2 text-xs text-muted-foreground">* = nome recuperado via hidratação individual</p>
                </div>

                {sample.errors.length > 0 && (
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer text-destructive">Erros ({sample.errors.length})</summary>
                    <pre className="mt-2 overflow-auto rounded bg-muted p-2">{sample.errors.join("\n")}</pre>
                  </details>
                )}
              </>
            )}
          </Card>

          {diagnosis && (
            <Card className={`p-4 border-l-4 ${
              diagnosis.level === "ok" ? "border-l-green-500" :
              diagnosis.level === "warn" ? "border-l-amber-500" : "border-l-destructive"
            }`}>
              <h2 className="text-lg font-semibold">Diagnóstico</h2>
              <p className="mt-1 font-medium">{diagnosis.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{diagnosis.text}</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-green-600" : tone === "warn" ? "text-amber-600" : tone === "bad" ? "text-destructive" : "";
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
