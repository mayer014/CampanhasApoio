import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Returns the current Supabase access token for serverFn calls that need it. */
export function useAccessToken(): string | null {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setToken(s?.access_token ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return token;
}
