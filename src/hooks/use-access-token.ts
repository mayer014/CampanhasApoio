import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Returns the current Supabase access token for serverFn calls that need it. */
export function useAccessToken(): string | null {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const resolveToken = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !active) return;

      const session = data.session;
      if (!session) {
        setToken(null);
        return;
      }

      const expiresSoon =
        typeof session.expires_at === "number" &&
        session.expires_at * 1000 <= Date.now() + 60_000;

      if (!expiresSoon) {
        setToken(session.access_token ?? null);
        return;
      }

      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (!active) return;

      if (refreshError) {
        setToken(session.access_token ?? null);
        return;
      }

      setToken(refreshed.session?.access_token ?? session.access_token ?? null);
    };

    void resolveToken();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!active) return;
      setToken(s?.access_token ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return token;
}
