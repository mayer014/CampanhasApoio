import { createStart } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// Registra o attacher global: toda chamada de createServerFn passa a enviar
// `Authorization: Bearer <access_token>` automaticamente quando há sessão.
// Sem isso, qualquer serverFn protegida por requireSupabaseAuth retorna 401.
export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
}));
