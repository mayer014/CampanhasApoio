import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, ExternalLink, GripVertical, Facebook, Instagram, Search } from "lucide-react";
import { toast } from "sonner";

interface Mission {
  id: string;
  title: string;
  description: string;
  platform: string;
  post_url: string | null;
  fb_post_url: string | null;
  ig_post_url: string | null;
  whatsapp_template: string | null;
  is_active: boolean;
  display_order: number;
}

export function PortalMissionsPanel({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: missions, isLoading } = useQuery({
    queryKey: ["portal-missions", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_missions")
        .select("*")
        .eq("client_id", clientId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as Mission[];
    }
  });

  const mutation = useMutation({
    mutationFn: async (payload: Partial<Mission>) => {
      if (payload.id) {
        const { error } = await supabase
          .from("portal_missions")
          .update(payload)
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        // Ensure required fields for insert
        const { error } = await supabase
          .from("portal_missions")
          .insert({
            client_id: clientId,
            title: payload.title!,
            platform: payload.platform!,
            post_url: payload.post_url!,
            description: payload.description,
            is_active: payload.is_active,
            display_order: payload.display_order ?? 0
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-missions"] });
      setIsAddOpen(false);
      setEditingMission(null);
      toast.success("Missão salva!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar: " + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("portal_missions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-missions"] });
      setDeletingId(null);
      toast.success("Missão excluída");
    }
  });

  const toggleActive = (id: string, current: boolean) => {
    mutation.mutate({ id, is_active: !current });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Missões Ativas</h2>
          <p className="text-sm text-muted-foreground">
            Missões que aparecem no portal para seus apoiadores.
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Nova Missão
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <MissionForm 
              onSave={(data) => mutation.mutate(data)} 
              isSubmitting={mutation.isPending} 
              clientId={clientId}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Card key={i} className="h-24 w-full" />)}
        </div>
      ) : missions?.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <p className="text-muted-foreground">Nenhuma missão ativa cadastrada.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {missions?.map((m) => (
            <Card key={m.id} className="p-4 flex items-center gap-4 group">
              <GripVertical className="h-5 w-5 text-muted-foreground/30" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{m.title}</h3>
                  {m.platform === 'facebook' ? <Facebook className="h-3.5 w-3.5 text-blue-600" /> : <Instagram className="h-3.5 w-3.5 text-pink-600" />}
                </div>
                <p className="text-xs text-muted-foreground truncate max-w-md">{m.post_url}</p>
              </div>
              <div className="flex items-center gap-3">
                <Switch 
                  checked={m.is_active} 
                  onCheckedChange={() => toggleActive(m.id, m.is_active)}
                />
                <Button variant="ghost" size="icon" onClick={() => setEditingMission(m)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeletingId(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingMission} onOpenChange={() => setEditingMission(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <MissionForm 
            mission={editingMission || undefined} 
            onSave={(data) => mutation.mutate({ ...data, id: editingMission?.id })} 
            isSubmitting={mutation.isPending}
            clientId={clientId}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir missão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A missão será removida do portal dos apoiadores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MissionForm({ mission, onSave, isSubmitting, clientId }: { mission?: Mission; onSave: (data: any) => void; isSubmitting: boolean; clientId: string }) {
  const [form, setForm] = useState({
    title: mission?.title || "",
    description: mission?.description || "",
    post_url: mission?.post_url || "",
    platform: mission?.platform || "facebook",
    is_active: mission?.is_active ?? true
  });
  const [selectionMode, setSelectionMode] = useState<'url' | 'select'>(mission?.post_url ? 'url' : 'select');

  const { data: recentPosts, isLoading: isLoadingPosts } = useQuery({
    queryKey: ["recent-posts-for-missions", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_posts_cache")
        .select("id, caption, permalink, platform")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: selectionMode === 'select'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.post_url) {
      toast.error("Preencha título e selecione ou cole a URL do post");
      return;
    }
    
    // Auto detect platform from URL
    let platform = form.platform;
    if (form.post_url.includes("facebook.com") || form.post_url.includes("fb.com") || form.post_url.includes("fb.watch")) {
      platform = "facebook";
    } else if (form.post_url.includes("instagram.com")) {
      platform = "instagram";
    }

    onSave({ ...form, platform });
  };

  const handlePostSelect = (post: any) => {
    setForm({
      ...form,
      title: form.title || post.caption?.slice(0, 50) || "Nova Missão",
      post_url: post.permalink,
      platform: post.platform
    });
    setSelectionMode('url'); // Switch back to see the result or let user edit
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <DialogHeader>
        <DialogTitle>{mission ? "Editar Missão" : "Nova Missão"}</DialogTitle>
      </DialogHeader>
      
      <div className="space-y-2">
        <Label htmlFor="title">Título da Missão</Label>
        <Input 
          id="title" 
          value={form.title} 
          onChange={e => setForm({...form, title: e.target.value})} 
          placeholder="Ex: Comente no post sobre segurança" 
        />
      </div>

      <div className="space-y-3">
        <Label>Origem do Post</Label>
        <Tabs value={selectionMode} onValueChange={(v: any) => setSelectionMode(v)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="select" className="text-xs">Selecionar Post</TabsTrigger>
            <TabsTrigger value="url" className="text-xs">Colar Link Manual</TabsTrigger>
          </TabsList>
          
          <TabsContent value="select" className="space-y-2 mt-2">
            <div className="max-h-[250px] overflow-y-auto border rounded-md p-1 space-y-1 bg-muted/20">
              {isLoadingPosts ? (
                <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Search className="h-3 w-3 animate-spin" /> Carregando posts recentes...
                </div>
              ) : recentPosts?.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground italic">
                  Nenhum post encontrado nas suas redes conectadas.
                </div>
              ) : (
                recentPosts?.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => handlePostSelect(post)}
                    className={`w-full text-left p-2 rounded hover:bg-accent transition-colors text-xs flex gap-2 items-start border ${form.post_url === post.permalink ? 'border-primary bg-primary/5' : 'border-transparent'}`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {post.platform === 'facebook' ? <Facebook className="h-3 w-3 text-blue-600" /> : <Instagram className="h-3 w-3 text-pink-600" />}
                    </div>
                    <span className="line-clamp-2">{post.caption || "(Sem legenda)"}</span>
                  </button>
                ))
              )}
            </div>
            <p className="text-[10px] text-muted-foreground italic text-center">
              Mostrando os últimos 20 posts sincronizados.
            </p>
          </TabsContent>

          <TabsContent value="url" className="space-y-2 mt-2">
            <Label htmlFor="url" className="text-xs">URL do Post (Facebook ou Instagram)</Label>
            <Input 
              id="url" 
              value={form.post_url} 
              onChange={e => setForm({...form, post_url: e.target.value})} 
              placeholder="https://facebook.com/..." 
            />
          </TabsContent>
        </Tabs>
      </div>

      <div className="space-y-2">
        <Label htmlFor="desc">Descrição (opcional)</Label>
        <Input 
          id="desc" 
          value={form.description} 
          onChange={e => setForm({...form, description: e.target.value})} 
          placeholder="Instruções adicionais para o apoiador" 
        />
      </div>

      <div className="flex items-center gap-2 py-1">
        <Switch 
          id="active-form" 
          checked={form.is_active} 
          onCheckedChange={v => setForm({...form, is_active: v})} 
        />
        <Label htmlFor="active-form">Ativa imediatamente</Label>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Salvando..." : "Salvar Missão"}
        </Button>
      </DialogFooter>
    </form>
  );
}
