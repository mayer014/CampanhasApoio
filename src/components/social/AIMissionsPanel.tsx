
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, X, Facebook, Instagram, Globe, ArrowUp, ArrowRight, ArrowDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Suggestion {
  title: string;
  description: string;
  theme: string;
  platform: 'facebook' | 'instagram' | 'ambos';
  priority: 'alta' | 'media' | 'baixa';
}

export function AIMissionsPanel({ clientId }: { clientId: string }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: comments, isLoading: isLoadingComments } = useQuery({
    queryKey: ["recent-comments", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_comments")
        .select("text, topics")
        .eq("user_id", clientId)
        .order("posted_at", { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data || [];
    }
  });

  const generateSuggestions = async () => {
    setIsGenerating(true);
    try {
      // 1. Process themes locally
      const themes = processThemes(comments || []);
      const samples = (comments || []).slice(0, 30).map(c => c.text);

      // 2. Call edge function
      const { data, error } = await supabase.functions.invoke("suggest-missions", {
        body: { themes, commentSamples: samples, clientId }
      });

      if (error) throw error;
      setSuggestions(data.suggestions || []);
      toast.success("Sugestões geradas com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar sugestões. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const processThemes = (comments: any[]) => {
    const counts: Record<string, number> = {};
    comments.forEach(c => {
      (c.topics || []).forEach((t: string) => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme]) => theme);
  };

  const removeSuggestion = (index: number) => {
    setSuggestions(s => s.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sugestões da IA</h2>
          <p className="text-sm text-muted-foreground">
            IA analisa seus comentários para propor ações de engajamento.
          </p>
        </div>
        <Button 
          onClick={generateSuggestions} 
          disabled={isGenerating || isLoadingComments}
          className="gap-2"
        >
          {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {suggestions.length > 0 ? "Regenerar" : "Gerar sugestões"}
        </Button>
      </div>

      {isGenerating ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : suggestions.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-lg text-muted-foreground">Nenhuma sugestão ainda</h3>
          <p className="text-sm text-muted-foreground max-w-xs mt-1">
            Clique no botão acima para que nossa IA analise o clima das suas redes e proponha missões.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {suggestions.map((s, i) => (
            <Card key={i} className="p-5 relative group animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeSuggestion(i)}
              >
                <X className="h-4 w-4" />
              </Button>
              
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {s.platform === 'facebook' && <Facebook className="h-5 w-5 text-blue-600" />}
                  {s.platform === 'instagram' && <Instagram className="h-5 w-5 text-pink-600" />}
                  {s.platform === 'ambos' && <Globe className="h-5 w-5 text-primary" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold">{s.title}</h3>
                    <PriorityBadge priority={s.priority} />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{s.description}</p>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                    {s.theme}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  switch (priority) {
    case 'alta':
      return <Badge className="bg-destructive text-destructive-foreground gap-1"><ArrowUp className="h-3 w-3" /> Alta</Badge>;
    case 'media':
      return <Badge className="bg-amber-500 text-white gap-1"><ArrowRight className="h-3 w-3" /> Média</Badge>;
    case 'baixa':
      return <Badge variant="secondary" className="gap-1 text-muted-foreground"><ArrowDown className="h-3 w-3" /> Baixa</Badge>;
    default:
      return null;
  }
}
