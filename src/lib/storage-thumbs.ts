import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Patrón storage-first para portadas (reels/posts/historias):
 * el sync re-hostea los thumbnails de Meta en Storage (buckets reel-media /
 * story-media) porque las URLs crudas de scontent expiran en horas/días.
 * Estos helpers firman TODOS los media_storage_path en UN batch y prefieren
 * la signed URL estable sobre la URL cruda (fallback mientras el backfill
 * del sync no re-hosteó un media).
 *
 * Único punto de verdad del TTL y del fallback — antes este bloque estaba
 * copy-pasteado 4 veces entre la home y la página de Instagram.
 */

const SIGNED_THUMB_TTL_SECONDS = 3600;

export async function signStorageThumbs(
  supabase: SupabaseClient,
  bucket: "reel-media" | "story-media",
  paths: Iterable<string | null | undefined>
): Promise<Map<string, string>> {
  const unique = [...new Set([...paths].filter((p): p is string => !!p))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrls(unique, SIGNED_THUMB_TTL_SECONDS);
  for (const su of data ?? []) {
    if (su.signedUrl && su.path) map.set(su.path, su.signedUrl);
  }
  return map;
}

/** Signed URL del re-host si existe; sino la URL cruda de Meta; sino null. */
export function pickThumb(
  signed: Map<string, string>,
  storagePath: string | null | undefined,
  raw: string | null | undefined
): string | null {
  return (storagePath ? (signed.get(storagePath) ?? null) : null) || raw || null;
}
