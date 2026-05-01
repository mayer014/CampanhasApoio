import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/painel/link")({
  component: LinkPage,
});

function LinkPage() {
  const { user } = useAuth();
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("candidate_profiles").select("slug").eq("id", user.id).single().then(({ data }) => setSlug(data?.slug ?? null));
  }, [user]);

  const url = slug && typeof window !== "undefined" ? `${window.location.origin}/p/${slug}` : "";

  return (
    <div>
      <h1 className="text-3xl font-bold">Seu link público</h1>
      <p className="mt-1 text-muted-foreground">Compartilhe este link com seus eleitores. Eles vão trocar a foto do WhatsApp em segundos.</p>

      <Card className="mt-8 p-6">
        {!slug ? (
          <div className="text-muted-foreground">Carregando…</div>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={url} readOnly className="font-mono text-sm" />
              <Button onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado!"); }}>
                <Copy className="mr-2 h-4 w-4" /> Copiar
              </Button>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline"><ExternalLink className="mr-2 h-4 w-4" /> Abrir</Button>
              </a>
            </div>
            <div className="mt-6 flex justify-center">
              <img
                alt="QR Code do link"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`}
                className="rounded-lg border"
              />
            </div>
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Lembre-se: vá em <strong>Meus templates</strong> e ative qual será mostrado no link.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
