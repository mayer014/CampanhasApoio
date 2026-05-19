import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@/integrations/supabase/url";
import { userIdFromJwt } from "@/lib/jwt-decode.server";

export async function userIdFromToken(token: string): Promise<string> {
  return userIdFromJwt(token);
}

export function userClientFromToken(token: string) {
  const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmcHBta3FzZHFhd3Z5a2tnYWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjM3MzcsImV4cCI6MjA5MzE5OTczN30.LkEeROQWXN2HkRsEiiI4sjzBQf4OdDVuuCep48wL3Rg";
  const SUPABASE_URL =
    normalizeSupabaseUrl(process.env.SUPABASE_URL) ||
    normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL) ||
    "https://pfppmkqsdqawvykkgafe.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    FALLBACK_SUPABASE_PUBLISHABLE_KEY;

  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}