/**
 * competitor-scraper.service.ts
 * Scrapes competitor Instagram profiles and their reels via Apify.
 *
 * Key pieces:
 *  - `apify~instagram-profile-scraper` → profile metadata (followers, bio, avatar).
 *  - `apify~instagram-reel-scraper` → /reels/ tab reels from the last 30 days.
 *  - `apify~instagram-post-scraper` → feed/grid posts; used only to detect
 *    "trial reels": reels that appear in the /reels/ tab but NOT in the grid
 *    (Instagram's "share to feed: off" mode). Best-effort — if this actor
 *    fails or returns nothing, maybe_trial stays NULL and the rest of the
 *    scrape proceeds normally.
 *
 * Progress is emitted to `workspace_competitors.scrape_progress` (jsonb) at
 * every phase. The UI polls GET /api/v1/competitors/[id] every 2s and renders
 * the `message` field so the user knows what's happening during the ~2-3 min
 * scrape+analyze window.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getApifyToken as getApifyTokenFromEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

// ─── Constants ──────────────────────────────────────────────────────────────

const APIFY_PROFILE_SCRAPER_ACTOR = 'apify~instagram-profile-scraper';
const APIFY_REEL_SCRAPER_ACTOR = 'apify~instagram-reel-scraper';
const APIFY_POST_SCRAPER_ACTOR = 'apify~instagram-post-scraper';
const APIFY_BASE_URL = 'https://api.apify.com/v2/acts';

// Defaults (el caller los clampea por tier via opts: standard 20 reels/30 días,
// pro 100 reels/90 días — TIER_CONFIG.maxReelsPerScrape / scrapeWindowDays).
const SCRAPE_WINDOW_DAYS = 90;
const MAX_REELS_PER_SCRAPE = 100;
// Grid para trial-detection: el PRIMER scrape necesita la historia completa
// (200 posts); los re-scrapes solo comparan reels nuevos → 30 alcanza.
// Antes era 200 SIEMPRE = ~$0.50 invisibles por click (más que los reels).
const MAX_GRID_POSTS_FIRST = 200;
const MAX_GRID_POSTS_RESCRAPE = 30;

// ─── Progress reporting ─────────────────────────────────────────────────────

type ScrapeProgress = {
  phase:
    | 'starting'
    | 'scraping_profile'
    | 'scraping_reels'
    | 'scraping_grid'
    | 'uploading_thumbs'
    | 'saving'
    | 'done'
    // Terminal con falla: la UI lo muestra como error amigable (no overlay) y
    // lo ack-ea con DELETE /scrape para que no re-aparezca.
    | 'error';
  message: string;
  current?: number;
  total?: number;
};

async function setProgress(
  supabase: SupabaseClient,
  competitorId: string,
  progress: ScrapeProgress,
): Promise<void> {
  // Escribimos con el client regular; el endpoint ya respeta RLS del workspace.
  // Best-effort: si falla, no rompemos el scrape por un update cosmético.
  try {
    await supabase
      .from('workspace_competitors')
      .update({ scrape_progress: progress })
      .eq('id', competitorId);
  } catch (err) {
    console.warn('[competitor-scraper] setProgress failed:', err);
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApifyProfileResult {
  username?: string;
  fullName?: string;
  biography?: string;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  profilePicUrl?: string;
  externalUrl?: string;
  isVerified?: boolean;
  isBusinessAccount?: boolean;
  businessCategoryName?: string;
}

interface ApifyReelResult {
  id?: string;
  shortCode?: string;
  url?: string;
  caption?: string;
  hashtags?: string[];
  mentions?: string[];
  commentsCount?: number;
  likesCount?: number;
  sharesCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  timestamp?: string;
  videoDuration?: number;
  transcript?: string;
  displayUrl?: string;
  videoUrl?: string;
  isVideo?: boolean;
  productType?: string;
  type?: string;
  locationName?: string;
  locationId?: string;
  taggedUsers?: Array<{ username?: string } | string>;
  taggedAccounts?: Array<{ username?: string } | string>;
  musicInfo?: {
    artist_name?: string;
    song_name?: string;
  };
}

interface ApifyPostResult {
  shortCode?: string;
  id?: string;
  url?: string;
  timestamp?: string;
}

export interface CompetitorProfileData {
  ig_username: string;
  ig_full_name: string | null;
  ig_bio: string | null;
  ig_follower_count: number | null;
  ig_following_count: number | null;
  ig_post_count: number | null;
  ig_profile_pic_url: string | null;
  ig_external_url: string | null;
  ig_is_verified: boolean;
  ig_is_business: boolean;
  ig_business_category: string | null;
  scraped_at: string;
}

export interface CompetitorReelData {
  short_code: string | null;
  permalink: string | null;
  caption: string | null;
  likes_count: number | null;
  comments_count: number | null;
  views_count: number | null;
  shares_count: number | null;
  duration_seconds: number | null;
  published_at: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  transcript: string | null;
  hashtags: string[];
  mentions: string[];
  music_artist: string | null;
  music_name: string | null;
  location_name: string | null;
  location_id: string | null;
  tagged_users: string[];
  product_type: string | null;
  is_video: boolean | null;
  // True si el reel aparece en /reels/ pero NO en el grid del perfil →
  // Instagram "Share to feed: off", señal fuerte de trial reel.
  // NULL si no pudimos scrapear el grid (actor falló, timeout, etc.).
  maybe_trial: boolean | null;
}

export interface ScrapeResult {
  profile: CompetitorProfileData | null;
  reels: CompetitorReelData[];
  reelsInserted: number;
  /** Posts del grid efectivamente scrapeados (para loguear su costo Apify). */
  gridPostsScraped: number;
  error?: string;
}

export interface ScrapeOptions {
  /** Tope de reels a traer (clamp por tier; default MAX_REELS_PER_SCRAPE). */
  maxReels?: number;
  /** Ventana máx en días (clamp por tier; default SCRAPE_WINDOW_DAYS). */
  windowDays?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getApifyToken(): string | null {
  const rawValue = getApifyTokenFromEnv()?.trim();
  if (!rawValue) return null;

  const unquotedValue = rawValue.replace(/^['"]|['"]$/g, '');
  try {
    const parsedUrl = new URL(unquotedValue);
    const tokenFromUrl = parsedUrl.searchParams.get('token');
    if (tokenFromUrl) return tokenFromUrl;
  } catch { /* not a URL */ }

  const tokenMatch = unquotedValue.match(/apify_api_[A-Za-z0-9]+/);
  return tokenMatch?.[0] ?? unquotedValue;
}

function extractUsername(igUrl: string): string {
  const cleaned = igUrl.trim().replace(/\/$/, '');
  if (cleaned.startsWith('@')) return cleaned.slice(1);
  try {
    const url = new URL(cleaned.startsWith('http') ? cleaned : `https://${cleaned}`);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[0] ?? cleaned;
  } catch {
    return cleaned;
  }
}

function toNullableString(val: string | undefined | null): string | null {
  return val && val.trim().length > 0 ? val.trim() : null;
}

// ─── Profile Scraping ───────────────────────────────────────────────────────

async function scrapeProfile(username: string, token: string): Promise<CompetitorProfileData | null> {
  const endpoint = `${APIFY_BASE_URL}/${APIFY_PROFILE_SCRAPER_ACTOR}/run-sync-get-dataset-items?${new URLSearchParams({ token })}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usernames: [username],
      resultsLimit: 1,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    console.warn(`[competitor-scraper] Profile scrape failed for @${username}:`, response.status);
    return null;
  }

  const data = await response.json() as ApifyProfileResult[];
  const item = data[0];
  if (!item) return null;

  return {
    ig_username: item.username ?? username,
    ig_full_name: toNullableString(item.fullName),
    ig_bio: toNullableString(item.biography),
    ig_follower_count: item.followersCount ?? null,
    ig_following_count: item.followingCount ?? null,
    ig_post_count: item.postsCount ?? null,
    ig_profile_pic_url: toNullableString(item.profilePicUrl),
    ig_external_url: toNullableString(item.externalUrl),
    ig_is_verified: item.isVerified ?? false,
    ig_is_business: item.isBusinessAccount ?? false,
    ig_business_category: toNullableString(item.businessCategoryName),
    scraped_at: new Date().toISOString(),
  };
}

// ─── Reels Scraping ─────────────────────────────────────────────────────────

async function scrapeReels(username: string, token: string, limit: number, windowDays: number): Promise<CompetitorReelData[]> {
  const endpoint = `${APIFY_BASE_URL}/${APIFY_REEL_SCRAPER_ACTOR}/run-sync-get-dataset-items?${new URLSearchParams({ token })}`;

  // Ventana acotada: el actor soporta `onlyPostsNewerThan` con un string
  // relativo tipo "30 days". Si no lo respeta, filtramos por fecha nosotros
  // abajo — esa defensa es barata.
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: [`https://www.instagram.com/${username}/reels/`],
      resultsLimit: limit,
      onlyPostsNewerThan: `${windowDays} days`,
      includeTranscript: false,
      includeSharesCount: true,
      includeDownloadedVideo: false,
      skipPinnedPosts: true,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    // NO tragarse el error: desde el 26/6 la fase de reels falló para TODOS los
    // workspaces (profile OK, reels 0) y nadie lo vio porque acá se devolvía []
    // como si fuera éxito. Tiramos con el status + body real de Apify para que
    // el caller lo loguee en integration_usage (status='error') y sea visible.
    const body = await response.text().catch(() => '');
    throw new Error(`Apify reels HTTP ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json() as ApifyReelResult[];

  // Filtro adicional por fecha: si el actor no respeta `onlyPostsNewerThan`,
  // cortamos cualquier reel publicado antes del umbral.
  const cutoffMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;

  return data
    .filter((item) => {
      if (!item.timestamp) return true; // sin fecha lo dejamos pasar
      const ts = new Date(item.timestamp).getTime();
      return Number.isFinite(ts) ? ts >= cutoffMs : true;
    })
    .map((item) => {
      const taggedRaw = item.taggedUsers ?? item.taggedAccounts ?? [];
      const tagged = Array.from(new Set(
        taggedRaw
          .map((u) => (typeof u === 'string' ? u : u?.username))
          .filter((u): u is string => typeof u === 'string' && u.length > 0)
      ));

      return {
        short_code: toNullableString(item.shortCode),
        permalink: toNullableString(item.url),
        caption: toNullableString(item.caption),
        likes_count: item.likesCount ?? null,
        comments_count: item.commentsCount ?? null,
        views_count: item.videoViewCount ?? item.videoPlayCount ?? null,
        shares_count: item.sharesCount ?? null,
        duration_seconds: item.videoDuration ?? null,
        published_at: item.timestamp ?? null,
        thumbnail_url: toNullableString(item.displayUrl),
        video_url: toNullableString(item.videoUrl),
        transcript: toNullableString(item.transcript),
        hashtags: item.hashtags ?? [],
        mentions: item.mentions ?? [],
        music_artist: toNullableString(item.musicInfo?.artist_name),
        music_name: toNullableString(item.musicInfo?.song_name),
        location_name: toNullableString(item.locationName),
        location_id: toNullableString(item.locationId),
        tagged_users: tagged,
        product_type: toNullableString(item.productType ?? item.type),
        is_video: item.isVideo ?? null,
        maybe_trial: null, // se setea después del scrape del grid
      };
    });
}

// ─── Grid (feed) scraping for trial-reel detection ──────────────────────────

/**
 * Best-effort: scrapea el grid/feed del perfil y devuelve el set de
 * shortcodes visibles. Si el actor falla o devuelve vacío, retornamos null y
 * el caller deja `maybe_trial` en NULL para todos los reels.
 *
 * La lógica de trial-detection depende de esta diferencia:
 *   gridShortcodes  ⊇ los reels que el competidor "mostró" en su perfil
 *   reelsShortcodes ⊇ todos los reels (incluye los con "share to feed: off")
 *   trial = reels \ grid
 */
async function scrapeGridShortcodes(
  username: string,
  token: string,
  limit: number,
): Promise<{ shortcodes: Set<string>; posts: number } | null> {
  const endpoint = `${APIFY_BASE_URL}/${APIFY_POST_SCRAPER_ACTOR}/run-sync-get-dataset-items?${new URLSearchParams({ token })}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: [`https://www.instagram.com/${username}/`],
        resultsLimit: limit,
        // NO se pasa onlyPostsNewerThan ni skipPinnedPosts:
        // instagram-post-scraper no soporta esos parámetros de la misma forma
        // que el reel-scraper, y su presencia hacía que el actor devolviera
        // casi 0 resultados (solo 2 posts) en lugar del grid completo.
        // El filtrado de fecha ya ocurre en scrapeReels — aquí solo necesitamos
        // el set completo de shortcodes del perfil para detectar trials.
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(90000),
    });

    if (!response.ok) {
      console.warn(`[competitor-scraper] Grid scrape failed for @${username}:`, response.status);
      return null;
    }

    const data = await response.json() as ApifyPostResult[];
    const shortcodes = new Set<string>();
    for (const item of data) {
      // Primary: explicit shortCode field
      const sc = toNullableString(item.shortCode)
        // Fallback: extract from URL (e.g. instagram.com/p/ABC or /reel/ABC)
        ?? toNullableString(item.url)?.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/)?.[1]
        ?? null;
      if (sc) shortcodes.add(sc);
    }
    console.log(`[competitor-scraper] Grid @${username}: ${data.length} posts → ${shortcodes.size} shortcodes`);
    return { shortcodes, posts: data.length };
  } catch (err) {
    console.warn('[competitor-scraper] Grid scrape exception:', err);
    return null;
  }
}

// ─── Image Storage Helpers ──────────────────────────────────────────────────

const STORAGE_BUCKET = 'competitor-assets';

async function downloadAndUploadImage(
  sourceUrl: string,
  storagePath: string
): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';

    const adminClient = createAdminClient();
    const { error } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (error) {
      console.warn('[competitor-scraper] Storage upload error:', error.message);
      return null;
    }

    const { data } = adminClient.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  } catch (err) {
    console.warn('[competitor-scraper] Image upload failed:', err);
    return null;
  }
}

// ─── Main scrape function ───────────────────────────────────────────────────

export async function scrapeCompetitor(
  supabase: SupabaseClient,
  competitorId: string,
  workspaceId: string,
  opts?: ScrapeOptions
): Promise<ScrapeResult> {
  const token = getApifyToken();
  if (!token) {
    return { profile: null, reels: [], reelsInserted: 0, gridPostsScraped: 0, error: 'APIFY_API_TOKEN not configured' };
  }

  await setProgress(supabase, competitorId, { phase: 'starting', message: 'Preparando scrape...' });

  const { data: competitor, error: fetchError } = await supabase
    .from('workspace_competitors')
    .select('id, name, ig_url, workspace_id, last_scraped_at')
    .eq('id', competitorId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (fetchError || !competitor) {
    return { profile: null, reels: [], reelsInserted: 0, gridPostsScraped: 0, error: 'Competitor not found' };
  }

  if (!competitor.ig_url) {
    return { profile: null, reels: [], reelsInserted: 0, gridPostsScraped: 0, error: 'No Instagram URL configured for this competitor' };
  }

  const username = extractUsername(competitor.ig_url);
  const maxReels = opts?.maxReels ?? MAX_REELS_PER_SCRAPE;
  const tierWindowDays = opts?.windowDays ?? SCRAPE_WINDOW_DAYS;

  // Ventana INCREMENTAL: re-scrapear la ventana completa del tier en cada
  // click era el pozo de plata clásico (re-pagar los mismos reels de 90 días
  // una y otra vez). Si hay un scrape previo reciente, solo pedimos lo nuevo
  // (+7 días de colchón para que el actor actualice métricas recientes).
  // Full refresh si el último scrape fue hace >30 días o nunca.
  const prevScrapedAtMs = competitor.last_scraped_at
    ? new Date(competitor.last_scraped_at).getTime()
    : null;
  let windowDays = tierWindowDays;
  if (prevScrapedAtMs) {
    const daysSince = (Date.now() - prevScrapedAtMs) / 86_400_000;
    if (daysSince <= 30) {
      windowDays = Math.max(1, Math.min(tierWindowDays, Math.ceil(daysSince) + 7));
    }
  }

  // Grid dinámico: 200 posts solo el PRIMER scrape (trial-detection necesita
  // la historia completa); 30 en re-scrapes (solo comparamos reels nuevos).
  const { count: existingReelCount } = await supabase
    .from('competitor_reels')
    .select('id', { count: 'exact', head: true })
    .eq('competitor_id', competitorId);
  const gridLimit = (existingReelCount ?? 0) > 0 ? MAX_GRID_POSTS_RESCRAPE : MAX_GRID_POSTS_FIRST;

  // Fase 1-3 en paralelo: profile, reels de la ventana, grid del perfil.
  // Los 3 actors de Apify son independientes; correrlos concurrentes corta
  // ~60-90s del scrape total.
  await setProgress(supabase, competitorId, {
    phase: 'scraping_reels',
    message: `Bajando reels y perfil de @${username} (últimos ${windowDays} días)...`,
  });

  // Si la fase de reels falla (HTTP de Apify o timeout), capturamos el motivo
  // para devolverlo como `error` en vez de fingir "éxito con 0 reels".
  let reelsError: string | null = null;

  const [profile, reels, gridResult] = await Promise.all([
    scrapeProfile(username, token).catch((err) => {
      console.error('[competitor-scraper] Profile error:', err);
      return null;
    }),
    scrapeReels(username, token, maxReels, windowDays).catch((err) => {
      reelsError = err instanceof Error ? err.message : String(err);
      console.error('[competitor-scraper] Reels error:', err);
      return [] as CompetitorReelData[];
    }),
    scrapeGridShortcodes(username, token, gridLimit).catch((err) => {
      console.error('[competitor-scraper] Grid error:', err);
      return null;
    }),
  ]);

  const gridShortcodes = gridResult?.shortcodes ?? null;
  const gridPostsScraped = gridResult?.posts ?? 0;

  // Tag `maybe_trial` SOLO para reels NUEVOS (publicados después del scrape
  // anterior). Antes el upsert re-computaba y PISABA maybe_trial de TODOS los
  // reels en cada re-scrape — borrando toggles manuales del usuario y, con el
  // grid recortado a 30 en re-scrapes, marcando como "trial" reels viejos que
  // simplemente ya no entran en el grid chico. Los reels existentes conservan
  // su valor en DB (se excluye la columna del upsert).
  const isNewReel = (reel: CompetitorReelData): boolean => {
    if (!prevScrapedAtMs) return true;
    if (!reel.published_at) return true;
    const ts = new Date(reel.published_at).getTime();
    return !Number.isFinite(ts) || ts > prevScrapedAtMs;
  };

  let trialCount = 0;
  const newReels = reels.filter(isNewReel);
  if (gridShortcodes && gridShortcodes.size > 0) {
    console.log(`[competitor-scraper] Trial detection @${username}: ${newReels.length} reels nuevos, ${gridShortcodes.size} grid shortcodes`);
    for (const reel of newReels) {
      if (!reel.short_code) {
        reel.maybe_trial = false;
        continue;
      }
      reel.maybe_trial = !gridShortcodes.has(reel.short_code);
      if (reel.maybe_trial) trialCount++;
    }
  } else {
    // Grid falló/vacío: default false (la mayoría NO son trials; null dejaba
    // el tab Trials vacío). Solo para nuevos — los viejos conservan su valor.
    if (newReels.length > 0) {
      console.warn(`[competitor-scraper] Grid scrape returned 0 shortcodes for @${username} — defaulting new reels to maybe_trial=false`);
    }
    for (const reel of newReels) {
      reel.maybe_trial = false;
    }
  }

  await setProgress(supabase, competitorId, {
    phase: 'scraping_reels',
    message: `${reels.length} reels encontrados${trialCount > 0 ? ` (${trialCount} posible${trialCount !== 1 ? 's' : ''} trial)` : ''}. Preparando portadas...`,
  });

  // Upload profile pic to Storage (persiste aunque el CDN de Meta expire)
  if (profile?.ig_profile_pic_url) {
    const storageUrl = await downloadAndUploadImage(
      profile.ig_profile_pic_url,
      `${workspaceId}/${competitorId}/profile.jpg`
    );
    if (storageUrl) profile.ig_profile_pic_url = storageUrl;
  }

  if (profile) {
    await supabase
      .from('workspace_competitors')
      .update({
        scraped_data: profile,
        last_scraped_at: new Date().toISOString(),
      })
      .eq('id', competitorId);

    if (profile.ig_follower_count && profile.ig_follower_count > 0) {
      const today = new Date().toISOString().slice(0, 10);
      await supabase
        .from('competitor_follower_snapshots')
        .upsert({
          competitor_id: competitorId,
          workspace_id: workspaceId,
          snapshot_date: today,
          follower_count: profile.ig_follower_count,
        }, { onConflict: 'competitor_id,snapshot_date' });
    }
  }

  // Reels falló de verdad (HTTP/timeout de Apify — distinto de "cuenta sin
  // reels"): cortar acá devolviendo el motivo real. El route lo loguea en
  // integration_usage con status='error' y así deja de ser invisible.
  if (reelsError && reels.length === 0) {
    return { profile, reels: [], reelsInserted: 0, gridPostsScraped, error: `Reels scrape: ${reelsError}` };
  }

  // Fase 4: upload thumbnails. Emitimos progreso granular — esta es la parte
  // visible para el user (puede durar 20-40s en scrapes con muchos reels).
  await setProgress(supabase, competitorId, {
    phase: 'uploading_thumbs',
    current: 0,
    total: reels.length,
    message: `Descargando portadas de ${reels.length} reels...`,
  });

  let thumbsDone = 0;
  const reelsWithStableUrls = await Promise.all(
    reels.map(async (reel, i) => {
      let result = reel;
      if (reel.thumbnail_url) {
        const key = reel.short_code ?? `reel-${i}`;
        const storageUrl = await downloadAndUploadImage(
          reel.thumbnail_url,
          `${workspaceId}/${competitorId}/reels/${key}.jpg`
        );
        if (storageUrl) result = { ...reel, thumbnail_url: storageUrl };
      }
      thumbsDone++;
      // Update cada ~3 thumbs (o en el último) — updates más frecuentes para
      // que la UI muestre el contador bajando rápido. Con ~47 reels son ~16
      // escrituras en la fase, trivial para la DB.
      if (thumbsDone % 3 === 0 || thumbsDone === reels.length) {
        await setProgress(supabase, competitorId, {
          phase: 'uploading_thumbs',
          current: thumbsDone,
          total: reels.length,
          message: `Descargando portadas ${thumbsDone} de ${reels.length}...`,
        });
      }
      return result;
    })
  );

  // Fase 5: persist
  await setProgress(supabase, competitorId, {
    phase: 'saving',
    message: `Guardando ${reelsWithStableUrls.length} reels en BD...`,
  });

  // UPSERT instead of delete+insert. Reasons:
  //   1. Preserves the row's `id` across scrapes — competitor_reel_snapshots
  //      references reel_id and would orphan otherwise.
  //   2. Preserves `competitor_reel_analysis` rows that the user already paid
  //      tokens for — analysis is keyed by competitor_reel_id.
  //   3. Preserves `maybe_trial` if the user manually toggled it.
  // The unique index `(competitor_id, short_code) WHERE short_code IS NOT NULL`
  // (migration 20260326000019) supports the conflict target.
  const scrapedAt = new Date().toISOString();
  const buildRow = (reel: CompetitorReelData) => ({
    competitor_id: competitorId,
    workspace_id: workspaceId,
    short_code: reel.short_code,
    permalink: reel.permalink,
    caption: reel.caption,
    likes_count: reel.likes_count,
    comments_count: reel.comments_count,
    views_count: reel.views_count,
    shares_count: reel.shares_count,
    duration_seconds: reel.duration_seconds,
    published_at: reel.published_at,
    thumbnail_url: reel.thumbnail_url,
    video_url: reel.video_url,
    transcript: reel.transcript,
    hashtags: reel.hashtags,
    mentions: reel.mentions,
    music_artist: reel.music_artist,
    music_name: reel.music_name,
    location_name: reel.location_name,
    location_id: reel.location_id,
    tagged_users: reel.tagged_users,
    product_type: reel.product_type,
    is_video: reel.is_video,
    raw_data: reel,
    scraped_at: scrapedAt,
  });

  const withShortCode = reelsWithStableUrls.filter((reel) => reel.short_code); // upsert needs the conflict key
  // Split: los NUEVOS escriben maybe_trial (recién computado); los EXISTENTES
  // omiten la columna → el upsert refresca métricas sin pisar el valor en DB
  // (incluye toggles manuales del usuario).
  const rowsNew = withShortCode.filter(isNewReel).map((reel) => ({ ...buildRow(reel), maybe_trial: reel.maybe_trial }));
  const rowsExisting = withShortCode.filter((reel) => !isNewReel(reel)).map(buildRow);
  const rowsToUpsert = [...rowsNew, ...rowsExisting];

  let reelsInserted = 0;
  if (rowsToUpsert.length > 0) {
    for (const rows of [rowsNew, rowsExisting]) {
      if (rows.length === 0) continue;
      const { error: bulkError, count } = await supabase
        .from('competitor_reels')
        .upsert(rows, { onConflict: 'competitor_id,short_code', count: 'exact' });
      if (bulkError) {
        console.error('[competitor-scraper] Bulk upsert error:', bulkError.message);
      } else {
        reelsInserted += count ?? rows.length;
      }
    }

    // Daily per-reel metrics snapshot. PRIMARY KEY (reel_id, snapshot_date) makes
    // this idempotent if the scrape runs twice on the same calendar day.
    // We need the row IDs back from the upsert to write the snapshot, so we
    // re-fetch by short_code (the upsert API doesn't reliably return ids on
    // conflict). Fast: indexed by (competitor_id, short_code).
    const shortCodes = rowsToUpsert.map((r) => r.short_code).filter((sc): sc is string => sc != null);
    if (shortCodes.length > 0) {
      const { data: persistedReels } = await supabase
        .from('competitor_reels')
        .select('id, short_code, views_count, likes_count, comments_count, shares_count')
        .eq('competitor_id', competitorId)
        .in('short_code', shortCodes);

      if (persistedReels && persistedReels.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const snapshotRows = persistedReels.map((r) => ({
          reel_id: r.id,
          workspace_id: workspaceId,
          snapshot_date: today,
          views_count: r.views_count,
          likes_count: r.likes_count,
          comments_count: r.comments_count,
          shares_count: r.shares_count,
        }));
        const { error: snapErr } = await supabase
          .from('competitor_reel_snapshots')
          .upsert(snapshotRows, { onConflict: 'reel_id,snapshot_date' });
        if (snapErr) {
          console.warn('[competitor-scraper] Reel snapshot write error:', snapErr.message);
        }
      }
    }
  }

  await setProgress(supabase, competitorId, {
    phase: 'done',
    message: `Scrape terminado: ${reelsInserted} reels`,
  });

  return { profile, reels: reelsWithStableUrls, reelsInserted, gridPostsScraped };
}

// ─── Check if scraping is available ─────────────────────────────────────────

export function isCompetitorScrapingEnabled(): boolean {
  return Boolean(getApifyToken());
}
