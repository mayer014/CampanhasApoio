import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "candidate" | "user" | null;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchRole(uid: string) {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .order("role", { ascending: true });

        if (error) throw error;

        const roles = (data?.map((x) => x.role) ?? []) as Array<"admin" | "candidate" | "user">;
        const r = roles.includes("admin")
          ? "admin"
          : roles.includes("candidate")
            ? "candidate"
            : roles.includes("user")
              ? "user"
              : null;

        if (active) {
          setRole(r as AppRole);
          setLoading(false);
        }
      } catch {
        if (active) {
          setRole(null);
          setLoading(false);
        }
      }
    }

    // Use getSession first, then listen to changes
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const s = data.session;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchRole(s.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;
      
      // If the event is just INITIAL_SESSION, we already handled it with getSession
      if (event === 'INITIAL_SESSION') return;

      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setLoading(true);
        fetchRole(s.user.id);
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    async function fetchRole(uid: string) {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .order("role", { ascending: true });

        if (error) throw error;

        const roles = (data?.map((x) => x.role) ?? []) as Array<"admin" | "candidate" | "user">;
        const r = roles.includes("admin")
          ? "admin"
          : roles.includes("candidate")
            ? "candidate"
            : roles.includes("user")
              ? "user"
              : null;

        if (active) {
          setRole(r as AppRole);
          setLoading(false);
        }
      } catch {
        if (active) {
          setRole(null);
          setLoading(false);
        }
      }
    }

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, user, role, loading, signOut };
}
