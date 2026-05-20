import { supabase } from "@/integrations/supabase/client";

function parseErrorText(raw: string): string {
  const text = raw.trim();
  if (!text) return "Erro interno na inteligência social";
  if (text === "[object Response]" || text === "Error: [object Response]") {
    return "Sessão não autorizada para consultar a inteligência social";
  }
  return text;
}

export function getSocialErrorMessage(error: unknown): string {
  if (error instanceof Response) {
    return parseErrorText(error.statusText || `HTTP ${error.status}`);
  }

  if (error instanceof Error) {
    return parseErrorText(error.message);
  }

  if (typeof error === "string") {
    return parseErrorText(error);
  }

  if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
    return parseErrorText((error as any).message);
  }

  return "Erro interno na inteligência social";
}

export async function withSocialAuth<T>(
  fn: (options: { headers: Record<string, string> }) => Promise<T>,
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Sessão expirada. Entre novamente para acessar a inteligência social.");
  }

  try {
    return await fn({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    throw new Error(getSocialErrorMessage(error));
  }
}