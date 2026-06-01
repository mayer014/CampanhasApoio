
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves the current candidate/client ID for the authenticated user.
 * In this system, the candidate_id is typically the same as the auth user ID.
 */
export async function resolveClientId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // For most users, their candidate_id is their own user.id
  // We check candidate_profiles to ensure it exists
  const { data: profile } = await supabase
    .from("candidate_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.id || null;
}
