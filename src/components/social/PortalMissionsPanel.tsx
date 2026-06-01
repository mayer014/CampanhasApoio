import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Edit, Trash2, ExternalLink, GripVertical, Facebook, Instagram, Search, Image as ImageIcon } from "lucide-react";
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
            post_url: payload.post_url,
            fb_post_url: payload.fb_post_url,
            ig_post_url: payload.ig_post_url,
            whatsapp_template: payload.whatsapp_template,
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
    fb_post_url: mission?.fb_post_url || "",
    ig_post_url: mission?.ig_post_url || "",
    whatsapp_template: mission?.whatsapp_template || "",
    platform: mission?.platform || "ambos",
    is_active: mission?.is_active ?? true
  });
  const [selectionMode, setSelectionMode] = useState<'url' | 'select'>(mission?.id ? 'url' : 'select');

  const { data: recentPosts, isLoading: isLoadingPosts } = useQuery({
    queryKey: ["recent-posts-for-missions-thumbs", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_posts_cache")
        .select("id, caption, permalink, platform, thumbnail_url")
        .eq("user_id", clientId)
        .order("posted_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data || [];
    },
    enabled: selectionMode === 'select'
  });

  const generateWATemplate = (f: typeof form) => {
    let links = "";
    if (f.fb_post_url) links += `\n🔵 Facebook: ${f.fb_post_url}`;
    if (f.ig_post_url) links += `\n💖 Instagram: ${f.ig_post_url}`;
    if (!f.fb_post_url && !f.ig_post_url && f.post_url) links += `\n👉 Link: ${f.post_url}`;

    return `🚀 Apoiador(a), temos uma nova missão para você!\n\n*${f.title}*\n${f.description || ""}\n${links}\n\nSua interação faz diferença. Vamos juntos!`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || (!form.post_url && !form.fb_post_url && !form.ig_post_url)) {
      toast.error("Preencha título e selecione ao menos um post");
      return;
    }
    
    // Auto detect platform
    let platform = "ambos";
    if (form.fb_post_url && !form.ig_post_url) platform = "facebook";
    if (form.ig_post_url && !form.fb_post_url) platform = "instagram";
    
    const finalTemplate = form.whatsapp_template || generateWATemplate(form);

    onSave({ ...form, platform, whatsapp_template: finalTemplate });
  };

  const togglePost = (post: any) => {
    const isFB = post.platform === 'facebook';
    const currentUrl = isFB ? form.fb_post_url : form.ig_post_url;
    
    const newForm = {
      ...form,
      [isFB ? 'fb_post_url' : 'ig_post_url']: currentUrl === post.permalink ? "" : post.permalink,
      title: form.title || post.caption?.slice(0, 50) || "Nova Missão"
    };

    // Auto-update WA template if not manually edited yet
    if (!form.whatsapp_template) {
      // It will be generated on save if empty
    }

    setForm(newForm);
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
            <div className="max-h-[350px] overflow-y-auto border rounded-md p-1 space-y-1 bg-muted/20">
              {isLoadingPosts ? (
                <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Search className="h-3 w-3 animate-spin" /> Carregando posts...
                </div>
              ) : recentPosts?.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground italic">
                  Nenhum post encontrado.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 p-1">
                  {recentPosts?.map((post) => {
                    const isSelected = form.fb_post_url === post.permalink || form.ig_post_url === post.permalink;
                    return (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => togglePost(post)}
                        className={`text-left p-1 rounded transition-colors flex flex-col border h-full ${isSelected ? 'border-primary bg-primary/10' : 'border-transparent bg-background hover:bg-accent'}`}
                      >
                        <div className="relative aspect-square w-full mb-1 rounded overflow-hidden bg-zinc-100">
                          {post.thumbnail_url ? (
                            <img src={post.thumbnail_url} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-400">
                              <ImageIcon className="h-6 w-6" />
                            </div>
                          )}
                          <div className="absolute top-1 right-1">
                            {post.platform === 'facebook' ? <Facebook className="h-4 w-4 text-blue-600 bg-white rounded-full p-0.5" /> : <Instagram className="h-4 w-4 text-pink-600 bg-white rounded-full p-0.5" />}
                          </div>
                          {isSelected && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <div className="bg-primary text-white rounded-full p-1"><Plus className="h-4 w-4 rotate-45" /></div>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] line-clamp-2 px-1 pb-1">{post.caption || "(Sem legenda)"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground italic text-center">
              Selecione um post do Facebook e um do Instagram para uma missão dupla.
            </p>
          </TabsContent>

          <TabsContent value="url" className="space-y-2 mt-2">
            <div className="space-y-3">
              <div>
                <Label htmlFor="fb_url" className="text-xs">URL Facebook</Label>
                <Input id="fb_url" value={form.fb_post_url} onChange={e => setForm({...form, fb_post_url: e.target.value})} placeholder="https://facebook.com/..." className="h-8 text-xs" />
              </div>
              <div>
                <Label htmlFor="ig_url" className="text-xs">URL Instagram</Label>
                <Input id="ig_url" value={form.ig_post_url} onChange={e => setForm({...form, ig_post_url: e.target.value})} placeholder="https://instagram.com/..." className="h-8 text-xs" />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="space-y-2">
        <Label htmlFor="desc">Descrição no Portal (opcional)</Label>
        <Input 
          id="desc" 
          value={form.description} 
          onChange={e => setForm({...form, description: e.target.value})} 
          placeholder="Ex: Curta e deixe seu comentário de apoio!" 
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="wa_template">Mensagem para WhatsApp (Autogerada)</Label>
        <Textarea 
          id="wa_template" 
          value={form.whatsapp_template} 
          onChange={e => setForm({...form, whatsapp_template: e.target.value})} 
          placeholder="Gera automaticamente ao salvar se vazio"
          className="h-24 text-xs font-sans"
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
