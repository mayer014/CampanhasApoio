/**
 * Decodifica e valida (exp) um JWT do Supabase localmente, sem fazer
 * chamada HTTP. O JWT já é assinado pelo Supabase e enviado via HTTPS
 * pelo próprio frontend autenticado — extraímos o `sub` (user id).
 *
 * Vantagem: não depende de SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY no
 * runtime do servidor self-hosted (EasyPanel, etc).
 */
export function userIdFromJwt(token: string): string {
  if (!token || typeof token !== "string") {
    throw new Error("Invalid or expired token");
  }
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid or expired token");

  let payload: { sub?: string; exp?: number };
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf-8");
    payload = JSON.parse(json);
  } catch {
    throw new Error("Invalid or expired token");
  }

  if (!payload.sub) throw new Error("Invalid or expired token");
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    throw new Error("Invalid or expired token");
  }
  return payload.sub;
}
