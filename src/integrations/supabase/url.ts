const SUPABASE_SERVICE_SUFFIXES = [
  "/rest/v1",
  "/auth/v1",
  "/storage/v1",
  "/functions/v1",
];

export function normalizeSupabaseUrl(value?: string | null): string | undefined {
  if (!value) return undefined;

  let normalized = value.trim().replace(/\/+$/, "");
  for (const suffix of SUPABASE_SERVICE_SUFFIXES) {
    if (normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, -suffix.length);
      break;
    }
  }

  return normalized.replace(/\/+$/, "") || undefined;
}