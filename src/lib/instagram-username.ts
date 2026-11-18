/**
 * Normalización de usernames de Instagram.
 *
 * Los competidores se guardan con `ig_url` en formatos variados según por dónde
 * se cargaron (modal del ADN, chat de onboarding): "@user", "user",
 * "instagram.com/user", "https://www.instagram.com/user/?igsh=...". Esta función
 * los lleva todos a la misma forma canónica (sin @, en minúsculas) para poder
 * deduplicar y armar URLs válidas.
 *
 * Pura: sin I/O. La usan el scraper, las rutas de ADN y la UI de competencia.
 * (La edge function Deno `scrape-competitors` tiene su propia copia.)
 */

export function normalizeIgUsername(raw: string | null | undefined): string {
  if (!raw) return '';
  const cleaned = raw.trim().replace(/\/+$/, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('@')) return cleaned.slice(1).trim().toLowerCase();

  const looksLikeUrl = /^https?:\/\//i.test(cleaned) || /(^|\.)instagram\.com/i.test(cleaned);
  if (looksLikeUrl) {
    try {
      const url = new URL(/^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`);
      const first = url.pathname.split('/').filter(Boolean)[0] ?? '';
      return first.replace(/^@/, '').toLowerCase();
    } catch {
      return '';
    }
  }

  // Username "pelado" (ej. "danieaiello").
  return cleaned.replace(/^@/, '').toLowerCase();
}

/** URL pública del perfil, o null si no hay username utilizable. */
export function igProfileUrl(raw: string | null | undefined): string | null {
  const username = normalizeIgUsername(raw);
  return username ? `https://www.instagram.com/${username}/` : null;
}
