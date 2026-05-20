import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Send,
  RefreshCw,
  Image as ImageIcon,
  Star,
  Search,
  Loader2,
  Users,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchMessages,
  sendMessage,
  syncChats,
  syncContacts,
  toggleGroupFavorite,
} from "@/lib/whatsapp.functions";

type Chat = {
  id: string;
  jid: string;
  name: string | null;
  is_group: boolean;
  unread_count: number;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_from_me: boolean | null;
};

type Msg = {
  id?: string;
  message_id: string;
  jid: string;
  from_me: boolean;
  push_name: string | null;
  message_type: string;
  text: string | null;
  media_url: string | null;
  ts: string;
};

export function ChatPanel({
  accessToken,
  candidateId,
}: {
  accessToken: string | null;
  candidateId: string;
}) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [favoriteGroups, setFavoriteGroups] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [filter, setFilter] = useState<"all" | "1to1" | "group" | "fav">("all");
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // true => próximo render deve ancorar no fim (abertura/envio/nova msg quando perto do fim)
  const stickToBottomRef = useRef(true);
  // usado para preservar a posição visual ao prepender mensagens antigas
  const preserveScrollRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);
  const loadedJidRef = useRef<string | null>(null);

  const PAGE_SIZE = 50;

  const fetchPage = async (jid: string, beforeTs?: string) => {
    let q = supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("candidate_id", candidateId)
      .eq("jid", jid)
      .order("ts", { ascending: false })
      .limit(PAGE_SIZE);
    if (beforeTs) q = q.lt("ts", beforeTs);
    const { data } = await q;
    return ((data || []) as Msg[]).reverse();
  };

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const loadChats = async () => {
    const { data } = await supabase
      .from("whatsapp_chats")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    setChats(data || []);
    const { data: favs } = await supabase
      .from("whatsapp_groups")
      .select("jid, is_favorite")
      .eq("candidate_id", candidateId)
      .eq("is_favorite", true);
    setFavoriteGroups(new Set((favs || []).map((f) => f.jid)));
  };

  useEffect(() => {
    loadChats();
    const channel = supabase
      .channel(`wa-chat-${candidateId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_chats",
          filter: `candidate_id=eq.${candidateId}`,
        },
        () => loadChats()
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `candidate_id=eq.${candidateId}`,
        },
        (payload: any) => {
          const m = payload.new as Msg;
          if (selected && m.jid === selected.jid) {
            const wasNearBottom = isNearBottom();
            setMessages((prev) =>
              prev.find((x) => x.message_id === m.message_id) ? prev : [...prev, m]
            );
            if (wasNearBottom) stickToBottomRef.current = true;
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [candidateId, selected?.jid]);

  const loadMessages = async (chat: Chat) => {
    stickToBottomRef.current = true;
    setLoadingMsgs(true);
    setMessages([]);
    setHasMoreOlder(true);
    loadedJidRef.current = chat.jid;
    const cached = await fetchPage(chat.jid);
    setMessages(cached);
    if (cached.length < PAGE_SIZE) setHasMoreOlder(false);
    setLoadingMsgs(false);
    if (accessToken) {
      try {
        const res = await fetchMessages({
          data: {
            access_token: accessToken,
            candidate_id: candidateId,
            jid: chat.jid,
            limit: PAGE_SIZE,
          },
        });
        if (res.messages?.length && loadedJidRef.current === chat.jid) {
          const fresh = await fetchPage(chat.jid);
          const wasNearBottom = isNearBottom();
          setMessages(fresh);
          if (fresh.length < PAGE_SIZE) setHasMoreOlder(false);
          if (wasNearBottom) stickToBottomRef.current = true;
        }
      } catch {
        // ignore
      }
    }
    await supabase
      .from("whatsapp_chats")
      .update({ unread_count: 0 })
      .eq("candidate_id", candidateId)
      .eq("jid", chat.jid);
  };

  const loadOlder = async () => {
    if (!selected || loadingOlder || !hasMoreOlder || messages.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    setLoadingOlder(true);
    preserveScrollRef.current = { prevHeight: el.scrollHeight, prevTop: el.scrollTop };
    const oldest = messages[0].ts;
    const older = await fetchPage(selected.jid, oldest);
    if (older.length === 0) {
      setHasMoreOlder(false);
      preserveScrollRef.current = null;
    } else {
      if (older.length < PAGE_SIZE) setHasMoreOlder(false);
      setMessages((prev) => [...older, ...prev]);
    }
    setLoadingOlder(false);
  };

  useEffect(() => {
    if (selected) loadMessages(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.jid]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (preserveScrollRef.current) {
      const { prevHeight, prevTop } = preserveScrollRef.current;
      el.scrollTop = el.scrollHeight - prevHeight + prevTop;
      preserveScrollRef.current = null;
      return;
    }
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      stickToBottomRef.current = false;
    }
  }, [messages]);

  const onContainerScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop <= 40 && hasMoreOlder && !loadingOlder && !loadingMsgs) {
      void loadOlder();
    }
  };

  const onSync = async () => {
    if (!accessToken) return;
    setSyncing(true);
    try {
      const [chatsRes] = await Promise.all([
        syncChats({ data: { access_token: accessToken, candidate_id: candidateId } }),
        syncContacts({ data: { access_token: accessToken, candidate_id: candidateId } }),
      ]);
      const r: any = chatsRes;
      toast.success(
        `Sincronizado: ${r?.chats_saved ?? 0} conversas, ${r?.groups_saved ?? 0} grupos`
      );
      loadChats();
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    } finally {
      setSyncing(false);
    }
  };


  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${candidateId}/chat/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("whatsapp-media")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
      setMediaUrl(data.publicUrl);
      toast.success("Imagem anexada");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const onSend = async () => {
    if (!selected || !accessToken) return;
    if (!text && !mediaUrl) return;
    stickToBottomRef.current = true;
    setSending(true);
    try {
      await sendMessage({
        data: {
          access_token: accessToken,
          candidate_id: candidateId,
          jid: selected.jid,
          text: text || undefined,
          media_url: mediaUrl || undefined,
          caption: text || undefined,
        },
      });
      setText("");
      setMediaUrl(null);
      // reload
      setTimeout(() => loadMessages(selected), 300);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  const onToggleFav = async (chat: Chat) => {
    if (!chat.is_group || !accessToken) return;
    const { data: g } = await supabase
      .from("whatsapp_groups")
      .select("id")
      .eq("candidate_id", candidateId)
      .eq("jid", chat.jid)
      .maybeSingle();
    if (!g) return;
    try {
      const res = await toggleGroupFavorite({
        data: {
          access_token: accessToken,
          candidate_id: candidateId,
          group_id: g.id,
        },
      });
      setFavoriteGroups((prev) => {
        const n = new Set(prev);
        if (res.is_favorite) n.add(chat.jid);
        else n.delete(chat.jid);
        return n;
      });
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    }
  };

  const filteredChats = useMemo(() => {
    return chats.filter((c) => {
      if (filter === "1to1" && c.is_group) return false;
      if (filter === "group" && !c.is_group) return false;
      if (filter === "fav" && !favoriteGroups.has(c.jid)) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(c.name || "").toLowerCase().includes(s) && !c.jid.toLowerCase().includes(s))
          return false;
      }
      return true;
    });
  }, [chats, filter, search, favoriteGroups]);

  return (
    <Card className="overflow-hidden">
      <div className="grid h-[70vh] min-h-[36rem] grid-cols-1 md:grid-cols-[320px_1fr]">
        {/* Sidebar */}
        <div className="flex min-h-0 flex-col border-r bg-muted/20">
          <div className="space-y-2 border-b p-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button size="icon" variant="outline" onClick={onSync} disabled={syncing}>
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex gap-1">
              {(
                [
                  ["all", "Todos"],
                  ["1to1", "1:1"],
                  ["group", "Grupos"],
                  ["fav", "★"],
                ] as const
              ).map(([v, l]) => (
                <Button
                  key={v}
                  size="sm"
                  variant={filter === v ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setFilter(v as any)}
                >
                  {l}
                </Button>
              ))}
            </div>
          </div>
          <div className="chat-scrollbar min-h-0 flex-1 overflow-y-auto">
            {filteredChats.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma conversa. Clique em sincronizar.
              </div>
            ) : (
              filteredChats.map((c) => (
                <button
                  key={c.jid}
                  onClick={() => setSelected(c)}
                  className={`flex w-full items-start gap-2 border-b px-3 py-2 text-left hover:bg-accent ${
                    selected?.jid === c.jid ? "bg-accent" : ""
                  }`}
                >
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    {c.is_group ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {c.name || c.jid.split("@")[0]}
                      </span>
                      {c.last_message_at && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(c.last_message_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <p className="truncate text-xs text-muted-foreground">
                        {c.last_message_text || (c.is_group ? "Grupo" : "Conversa")}
                      </p>
                      {c.unread_count > 0 && (
                        <Badge className="ml-auto h-5 min-w-5 px-1.5 text-xs">
                          {c.unread_count}
                        </Badge>
                      )}
                      {c.is_group && favoriteGroups.has(c.jid) && (
                        <Star className="ml-auto h-3 w-3 fill-yellow-400 text-yellow-400" />
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex min-h-0 flex-col overflow-hidden">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              Selecione uma conversa
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    {selected.is_group ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">
                      {selected.name || selected.jid.split("@")[0]}
                    </div>
                    <div className="text-xs text-muted-foreground">{selected.jid}</div>
                  </div>
                </div>
                {selected.is_group && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onToggleFav(selected)}
                  >
                    <Star
                      className={`h-4 w-4 ${
                        favoriteGroups.has(selected.jid)
                          ? "fill-yellow-400 text-yellow-400"
                          : ""
                      }`}
                    />
                  </Button>
                )}
              </div>

              <div
                ref={scrollRef}
                onScroll={onContainerScroll}
                className="chat-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/10 p-4"
              >
                <div className="space-y-2">
                  {loadingOlder && (
                    <div className="py-1 text-center text-xs text-muted-foreground">
                      <Loader2 className="mx-auto h-3 w-3 animate-spin" />
                    </div>
                  )}
                  {!hasMoreOlder && messages.length > 0 && (
                    <div className="py-1 text-center text-[10px] text-muted-foreground opacity-60">
                      Início da conversa
                    </div>
                  )}
                  {loadingMsgs && messages.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </div>
                  )}
                  {messages.map((m) => (
                    <div
                      key={m.message_id}
                      className={`flex ${m.from_me ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                          m.from_me
                            ? "bg-primary text-primary-foreground"
                            : "border bg-card"
                        }`}
                      >
                        {selected.is_group && !m.from_me && m.push_name && (
                          <div className="mb-1 text-xs font-semibold opacity-80">
                            {m.push_name}
                          </div>
                        )}
                        {m.media_url && /image/.test(m.message_type) && (
                          <img
                            src={m.media_url}
                            alt=""
                            className="mb-1 max-h-64 rounded"
                          />
                        )}
                        {m.media_url && /audio/.test(m.message_type) && (
                          <audio controls src={m.media_url} className="mb-1 max-w-full" />
                        )}
                        {m.media_url && /video/.test(m.message_type) && (
                          <video
                            controls
                            src={m.media_url}
                            className="mb-1 max-h-64 w-full rounded"
                          />
                        )}
                        {m.media_url && /document/.test(m.message_type) && (
                          <a
                            href={m.media_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mb-1 block underline"
                          >
                            📎 Documento
                          </a>
                        )}
                        {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
                        <div className="mt-1 text-right text-[10px] opacity-60">
                          {new Date(m.ts).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="shrink-0 border-t bg-card p-3">
                {mediaUrl && (
                  <div className="mb-2 flex items-center gap-2 rounded border bg-muted/40 p-2 text-sm">
                    <ImageIcon className="h-4 w-4" />
                    <span className="flex-1 truncate">{mediaUrl.split("/").pop()}</span>
                    <Button size="sm" variant="ghost" onClick={() => setMediaUrl(null)}>
                      Remover
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/*,video/*,audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onUpload(f);
                      }}
                    />
                    <Button asChild variant="outline" size="icon" disabled={uploading}>
                      <span>
                        {uploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ImageIcon className="h-4 w-4" />
                        )}
                      </span>
                    </Button>
                  </label>
                  <Input
                    className="min-w-0 flex-1"
                    placeholder="Mensagem"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        onSend();
                      }
                    }}
                  />
                  <Button onClick={onSend} disabled={sending || (!text && !mediaUrl)}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
