// Server-only helpers for admin operations. NEVER import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function uniqueSlug(base: string, fallbackId: string): Promise<string> {
  let baseSlug = base ? slugify(base) : "";
  if (!baseSlug) baseSlug = fallbackId.slice(0, 8);
  let finalSlug = baseSlug;
  let i = 1;
  while (true) {
    const { data: exists } = await supabaseAdmin
      .from("candidate_profiles")
      .select("id")
      .eq("slug", finalSlug)
      .maybeSingle();
    if (!exists) return finalSlug;
    i++;
    finalSlug = `${baseSlug}-${i}`;
    if (i > 50) return `${baseSlug}-${fallbackId.slice(0, 6)}`;
  }
}
