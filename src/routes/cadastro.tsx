import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera, Sparkles, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Cadastro grátis — Foto de Campanha" },
      {
        name: "description",
        content:
          "Crie sua conta grátis e ganhe 5 fotos de campanha personalizadas. Sem cartão de crédito.",
      },
      { property: "og:title", content: "Cadastre-se grátis — Foto de Campanha" },
      {
        property: "og:description",
        content: "Ganhe 5 fotos de perfil personalizadas para sua campanha eleitoral.",
      },
    ],
  }),
  component: CadastroPage,
});

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI",
  "RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

function CadastroPage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    password: "",
  });

  useEffect(() => {
    if (!authLoading && user) {
      navigate({ to: role === "admin" ? "/admin" : "/painel" });
    }
  }, [authLoading, user, role, navigate]);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (!/^[A-Za-z]{2}$/.test(form.state)) {
      toast.error("Selecione o estado (UF).");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("public-signup-candidate", {
        body: {
          full_name: form.full_name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          phone: form.phone.trim(),
          city: form.city.trim(),
          state: form.state.toUpperCase(),
        },
      });
      if (error || (data as any)?.error) {
        const msg = (data as any)?.error || error?.message || "Não foi possível concluir o cadastro.";
        toast.error(msg);
        setSubmitting(false);
        return;
      }
      // Auto-login
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      if (loginErr) {
        toast.success("Conta criada! Faça login para continuar.");
        navigate({ to: "/login" });
        return;
      }
      toast.success("Bem-vindo! Você ganhou 5 fotos grátis 🎉");
      navigate({ to: "/painel" });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro inesperado");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg p-8">
        <Link to="/" className="mb-6 flex items-center gap-2">
          <Camera className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">Foto de Campanha</span>
        </Link>
        <h1 className="text-2xl font-bold">Cadastre-se grátis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie sua conta em menos de 1 minuto.
        </p>

        <div className="mt-4 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <strong>5 fotos grátis</strong> ao se cadastrar. Sem cartão de crédito. Após o trial,
            o acesso é liberado mediante pagamento e confirmação do administrador.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="full_name">Nome completo</Label>
            <Input id="full_name" required minLength={3} maxLength={120} value={form.full_name} onChange={update("full_name")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required maxLength={255} value={form.email} onChange={update("email")} />
            </div>
            <div>
              <Label htmlFor="phone">WhatsApp</Label>
              <Input id="phone" required minLength={8} maxLength={20} placeholder="(11) 90000-0000" value={form.phone} onChange={update("phone")} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
            <div>
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" required minLength={2} maxLength={80} value={form.city} onChange={update("city")} />
            </div>
            <div>
              <Label htmlFor="state">UF</Label>
              <select
                id="state"
                required
                value={form.state}
                onChange={(e) => setForm((s) => ({ ...s, state: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">UF</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="password">Senha (mín. 8 caracteres)</Label>
            <Input id="password" type="password" required minLength={8} maxLength={200} value={form.password} onChange={update("password")} />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? "Criando conta..." : "Criar conta grátis"}
          </Button>
        </form>

        <ul className="mt-6 space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> 5 fotos personalizadas no plano grátis</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Sem cartão de crédito</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Cancelamento a qualquer momento</li>
        </ul>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta? <Link to="/login" className="font-medium text-primary hover:underline">Entrar</Link>
        </p>
      </Card>
    </div>
  );
}
