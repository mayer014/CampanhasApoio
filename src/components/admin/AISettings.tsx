import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BrainCircuit, Save, Trash2, CheckCircle2, AlertTriangle, Eye, EyeOff } from "lucide-react";

type AIProvider = 'lovable' | 'openrouter' | 'openai' | 'anthropic' | 'groq';

type AISetting = {
  id: string;
  provider: AIProvider;
  model_name: string;
  api_key: string;
  is_active: boolean;
};

const PROVIDERS: { value: AIProvider; label: string; description: string }[] = [
  { value: 'lovable', label: 'Lovable Gateway', description: 'Google Gemini via Lovable Cloud' },
  { value: 'openai', label: 'OpenAI', description: 'Modelos GPT-4o, GPT-4o-mini' },
  { value: 'anthropic', label: 'Anthropic', description: 'Modelos Claude 3.5 Sonnet/Haiku' },
  { value: 'openrouter', label: 'OpenRouter', description: 'Acesso a centenas de modelos em um só lugar' },
  { value: 'groq', label: 'Groq Cloud', description: 'Llama 3 e Mixtral em alta velocidade (grátis/barato)' },
];

export function AISettings() {
  const [settings, setSettings] = useState<AISetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState<{
    provider: AIProvider;
    model_name: string;
    api_key: string;
  }>({
    provider: 'openai',
    model_name: '',
    api_key: '',
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('ai_settings' as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error("Erro ao carregar configurações de IA: " + error.message);
    } else {
      setSettings((data as unknown as AISetting[]) || []);
    }
    setLoading(false);
  }

  async function handleAdd() {
    if (!form.model_name || !form.api_key) {
      toast.error("Preencha todos os campos");
      return;
    }

    setBusy(true);
    const { error } = await supabase.from('ai_settings' as any).insert({
      provider: form.provider,
      model_name: form.model_name,
      api_key: form.api_key,
      is_active: settings.length === 0, // ativa se for a primeira
    });

    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Configuração adicionada");
      setForm({ ...form, model_name: '', api_key: '' });
      load();
    }
  }

  async function handleToggleActive(id: string, currentlyActive: boolean) {
    if (currentlyActive) return; // já está ativo

    setBusy(true);
    // Primeiro desativa todos
    await supabase.from('ai_settings' as any).update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    // Depois ativa o escolhido
    const { error } = await supabase.from('ai_settings' as any).update({ is_active: true }).eq('id', id);

    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Provedor de IA ativado");
      load();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta configuração?")) return;
    setBusy(true);
    const { error } = await supabase.from('ai_settings' as any).delete().eq('id', id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Removido");
      load();
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Configuração de LLM (IA)</CardTitle>
              <CardDescription>
                Defina qual inteligência artificial o sistema deve usar para análise de sentimento, respostas automáticas e sugestões.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Provedor</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => setForm({ ...form, provider: v as AIProvider })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome do Modelo</Label>
              <Input
                placeholder="ex: gpt-4o-mini, claude-3-5-sonnet, llama-3-70b"
                value={form.model_name}
                onChange={(e) => setForm({ ...form, model_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder="sk-..."
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={busy} className="w-full sm:w-auto">
            <Save className="mr-2 h-4 w-4" /> Adicionar Provedor
          </Button>

          <div className="mt-8 space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Provedores Configurados</h3>
            {loading ? (
              <div className="space-y-2">
                <div className="h-20 w-full animate-pulse rounded-lg bg-muted" />
                <div className="h-20 w-full animate-pulse rounded-lg bg-muted" />
              </div>
            ) : settings.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                Nenhum provedor configurado. O sistema usará o Lovable Gateway por padrão.
              </div>
            ) : (
              <div className="grid gap-4">
                {settings.map((s) => (
                  <div
                    key={s.id}
                    className={`relative flex items-center justify-between rounded-xl border p-4 transition-all ${
                      s.is_active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`mt-1 rounded-full p-2 ${s.is_active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold uppercase">{s.provider}</span>
                          <Badge variant="outline">{s.model_name}</Badge>
                          {s.is_active && <Badge className="bg-emerald-500 hover:bg-emerald-600">Ativo</Badge>}
                        </div>
                        <div className="mt-1 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                          {showKey[s.id] ? s.api_key : '••••••••••••••••'}
                          <button
                            onClick={() => setShowKey({ ...showKey, [s.id]: !showKey[s.id] })}
                            className="hover:text-foreground"
                          >
                            {showKey[s.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!s.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(s.id, false)}
                          disabled={busy}
                        >
                          Ativar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDelete(s.id)}
                        disabled={busy}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-bold">Dicas de uso:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 opacity-90">
                <li><strong>Groq Cloud:</strong> Ideal para velocidade instantânea. Use os modelos <code>llama-3.1-70b-versatile</code> ou <code>mixtral-8x7b-32768</code>.</li>
                <li><strong>OpenAI:</strong> O modelo <code>gpt-4o-mini</code> é extremamente barato e inteligente para a maioria das tarefas.</li>
                <li><strong>Anthropic:</strong> Use o <code>claude-3-5-sonnet-20240620</code> para tarefas que exigem o máximo de qualidade gramatical e nuance.</li>
                <li><strong>Fallback:</strong> Se nenhum provedor estiver ativo, o sistema tentará usar o <code>Lovable Gateway</code> (precisa de créditos no workspace).</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
