/**
 * Constantes de Meta Graph API — fuente única de verdad (lado Node).
 *
 * F2.5 — cliente Meta unificado. Este archivo es PURO (sin runtime, sin deps):
 * versión, base URL, field-lists y tabla de clasificación de errores. Tiene una
 * COPIA ESPEJO en supabase/functions/_shared/meta/constants.ts (lado Deno) —
 * deben mantenerse idénticas (un test de paridad en CI lo verifica). No se
 * comparten por import porque Node y Deno son runtimes distintos (el bundler de
 * Next excluye supabase/functions; el de Deno no resuelve alias @/).
 *
 * Las field-lists son COPIA TEXTUAL de supabase/functions/sync-instagram/index.ts
 * (verificadas byte a byte) para que centralizar no cambie ningún payload.
 */

/** Versión de Graph API. Bump = tocar este archivo + su espejo Deno. */
export const META_GRAPH_VERSION = 'v25.0';
export const GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

// ─── Field / metric lists (copia textual de sync-instagram) ───────────────────

/** Media de IG (reels + posts). */
export const MEDIA_FIELDS =
  'id,caption,media_type,media_product_type,permalink,media_url,thumbnail_url,timestamp,is_shared_to_feed';

/** Insights de reels (con fallback aparte si Meta rechaza con code 100/3001). */
export const REEL_INSIGHT_METRICS =
  'views,reach,likes,comments,shares,saved,total_interactions,ig_reels_avg_watch_time,ig_reels_video_view_total_time';

/** Insights de posts (no-reel). */
export const POST_INSIGHT_METRICS =
  'impressions,reach,likes,comments,shares,saved,total_interactions';

/** Insights diarios a nivel cuenta. */
export const ACCOUNT_DAILY_METRICS =
  'views,reach,profile_views,accounts_engaged,total_interactions,likes,comments,shares,saves,replies,website_clicks,profile_links_taps';

/** Creative de ads (resolución ad→reel). */
export const AD_CREATIVE_FIELDS =
  'id,name,campaign_id,adset_id,creative{id,object_story_id,effective_instagram_media_id,source_instagram_media_id,effective_object_story_id,instagram_permalink_url}';

/** Insights de ads (agregado). */
export const AD_INSIGHT_FIELDS =
  'ad_id,impressions,reach,clicks,spend,ctr,cpc,cpp,frequency,inline_link_clicks,outbound_clicks,video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p95_watched_actions,video_p100_watched_actions';

/** Insights de ads (diario, time_increment=1). */
export const AD_DAILY_FIELDS =
  'ad_id,date_start,date_stop,impressions,reach,clicks,spend,inline_link_clicks,outbound_clicks,video_play_actions,actions';

// ─── Field / metric lists secundarias (fallbacks + endpoints puntuales) ───────
// Copia textual de supabase/functions/sync-instagram/index.ts (verificadas byte a
// byte). Centralizarlas deja a sync-instagram sin literales de Graph inline; el
// payload no cambia.

/** Media probe liviano: chequear existencia/frescura sin traer todo. */
export const MEDIA_PROBE_FIELDS = 'id,timestamp';

/** Children de un carousel (thumbnail del primer slide / slides completos). */
export const MEDIA_CHILDREN_FIELDS = 'id,media_type,media_url,thumbnail_url';

/** Conteos directos del media (último recurso cuando /insights falla del todo). */
export const MEDIA_BASIC_COUNTS_FIELDS = 'like_count,comments_count';

/** Insights de reels — fallback reducido (sin total_interactions ni ig_reels_video_view_total_time). */
export const REEL_INSIGHT_METRICS_FALLBACK = 'views,reach,likes,comments,shares,saved,ig_reels_avg_watch_time';

/** Insights de posts — fallback reducido (sin shares ni total_interactions, que carousels no soportan). */
export const POST_INSIGHT_METRICS_FALLBACK = 'impressions,reach,likes,comments,saved';

/** Insight individual de 'saved' (último escalón del fallback de posts). */
export const POST_SAVED_ONLY_METRIC = 'saved';

/** Stories activas (últimas 24h). */
export const STORIES_FIELDS = 'id,media_type,media_url,thumbnail_url,caption,timestamp';

/** Insights por slide de story (v22.0+: solo views,reach,replies,navigation son válidas). */
export const STORY_INSIGHT_METRICS = 'views,reach,replies,navigation';

/** Campos de perfil de la cuenta IG (followers/follows/media counts). */
export const PROFILE_FIELDS = 'followers_count,follows_count,media_count';

/** Métrica diaria de follower_count (timeseries period=day). */
export const FOLLOWER_COUNT_METRIC = 'follower_count';

/** Métrica de demographics de seguidores (con breakdown, period=lifetime). */
export const DEMOGRAPHICS_METRIC = 'follower_demographics';

// ─── Clasificación de errores de Graph ────────────────────────────────────────
// Códigos verificados contra isTokenExpiredError (sync-instagram) + docs de Meta.

/** Token muerto de verdad → la conexión necesita re-auth (marcar expired). */
export const REAUTH_ERROR_CODES = [190, 102, 104, 467] as const;

/** Rate-limit / throttling de Meta → reintentar con backoff, NO marcar expired. */
export const RATE_LIMIT_ERROR_CODES = [4, 17, 32, 341, 613] as const;

/** Métrica no soportada en este media → caer al fallback de insights. */
export const UNSUPPORTED_METRIC_CODES = [100, 3001] as const;

export type MetaErrorKind = 'rate_limit' | 'needs_reauth' | 'unsupported_metric' | 'server' | 'client';

export interface MetaGraphError {
  code?: number;
  type?: string;
  message?: string;
  fbtrace_id?: string;
}

/**
 * Clasifica un error de Graph en una categoría accionable. Única fuente de
 * verdad — reemplaza el isTokenExpiredError disperso y agrega rate_limit
 * (que hoy no se detecta en ningún caller).
 */
export function classifyMetaError(err: MetaGraphError | undefined, httpStatus: number): MetaErrorKind {
  const code = err?.code;
  const type = err?.type;
  if (type === 'OAuthException' || (code != null && (REAUTH_ERROR_CODES as readonly number[]).includes(code))) {
    return 'needs_reauth';
  }
  if (httpStatus === 429 || (code != null && (RATE_LIMIT_ERROR_CODES as readonly number[]).includes(code))) {
    return 'rate_limit';
  }
  if (code != null && (UNSUPPORTED_METRIC_CODES as readonly number[]).includes(code)) {
    return 'unsupported_metric';
  }
  if (httpStatus >= 500) return 'server';
  return 'client';
}

/** ¿Conviene reintentar este tipo de error con backoff? */
export function isRetryableMetaError(kind: MetaErrorKind): boolean {
  return kind === 'rate_limit' || kind === 'server';
}
