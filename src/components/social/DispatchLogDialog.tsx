
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function DispatchLogDialog({ 
  dispatchId, 
  open, 
  onOpenChange 
}: { 
  dispatchId: string | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void 
}) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["dispatch-logs", dispatchId],
    queryFn: async () => {
      if (!dispatchId) return [];
      const { data, error } = await supabase
        .from("whatsapp_dispatch_items")
        .select("*")
        .eq("dispatch_id", dispatchId)
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!dispatchId && open
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Logs do Disparo</DialogTitle>
        </DialogHeader>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell>
              </TableRow>
            ) : logs?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">Nenhum log encontrado.</TableCell>
              </TableRow>
            ) : (
              logs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="font-medium">{log.contact_name || "Sem nome"}</div>
                    <div className="text-xs text-muted-foreground">{log.contact_phone}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      log.status === 'enviado' ? 'default' : 
                      log.status === 'falha' ? 'destructive' : 'secondary'
                    }>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {log.sent_at ? format(new Date(log.sent_at), "Pp", { locale: ptBR }) : "—"}
                  </TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">
                    {log.error_message || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
