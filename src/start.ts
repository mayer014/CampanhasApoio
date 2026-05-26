import { createStart } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// ─────────────────────────────────────────────────────────────────────────────
// Startup env diagnostics (Worker runtime).
// Loga uma única vez, sem expor valores — apenas presença, tamanho e prefixo.
// Útil para confirmar que SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
// SUPABASE_SERVICE_ROLE_KEY e META_APP_SECRET estão realmente disponíveis em
// produção (EasyPanel/Workers) antes do primeiro request.
// ─────────────────────────────────────────────────────────────────────────────
function describeEnv(name: string) {
  const v = (typeof process !== "undefined" ? process.env?.[name] : undefined) ?? "";
  return {
    name,
    present: v.length > 0,
    length: v.length,
    prefix: v ? v.slice(0, 6) : "",
  };
}

try {
  // eslint-disable-next-line no-console
  console.info("[startup] env diag", [
    describeEnv("SUPABASE_URL"),
    describeEnv("VITE_SUPABASE_URL"),
    describeEnv("SUPABASE_PUBLISHABLE_KEY"),
    describeEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
    describeEnv("SUPABASE_ANON_KEY"),
    describeEnv("SUPABASE_SERVICE_ROLE_KEY"),
    describeEnv("META_APP_SECRET"),
    describeEnv("META_BUSINESS_LOGIN_CONFIG_ID"),
  ]);
} catch {
  /* no-op */
}

// Registra o attacher global: toda chamada de createServerFn passa a enviar
// `Authorization: Bearer <access_token>` automaticamente quando há sessão.
// Sem isso, qualquer serverFn protegida por requireSupabaseAuth retorna 401.
export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
}));
