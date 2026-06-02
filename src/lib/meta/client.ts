/**
 * Cliente Meta Graph API — lado Node (F2.5).
 *
 * Centraliza: construcción de URL con la versión correcta, token como query
 * param (patrón actual del codebase — NO Bearer), lectura/clasificación de
 * error una sola vez, backoff exponencial con jitter ante errores transitorios
 * (hoy ausente en todos los callers), y paginación.
 *
 * Copia espejo en supabase/functions/_shared/meta/client.ts (Deno). El contrato
 * debe ser idéntico; cada copia usa su propio fetch/env del runtime.
 */

import {
  GRAPH_BASE,
  classifyMetaError,
  isRetryableMetaError,
  type MetaErrorKind,
  type MetaGraphError,
} from './constants';

export class MetaApiError extends Error {
  readonly kind: MetaErrorKind;
  readonly code?: number;
  readonly status: number;
  readonly retryable: boolean;
  readonly raw?: MetaGraphError;

  constructor(message: string, kind: MetaErrorKind, status: number, raw?: MetaGraphError) {
    super(message);
    this.name = 'MetaApiError';
    this.kind = kind;
    this.status = status;
    this.code = raw?.code;
    this.retryable = isRetryableMetaError(kind);
    this.raw = raw;
  }
}

export interface MetaFetchOptions {
  /** Access token de IG/FB. Se inyecta como query param access_token. */
  token: string;
  /** Params adicionales de query (fields, metric, limit, etc.). */
  params?: Record<string, string | number>;
  /** Cantidad de reintentos ante errores transitorios. Default 2. */
  maxRetries?: number;
  /** Timeout por intento en ms. Default 20000. */
  timeoutMs?: number;
}

interface GraphResponse<T> {
  data?: T;
  error?: MetaGraphError;
  paging?: { next?: string };
  [k: string]: unknown;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Llama a un endpoint de Graph y devuelve el JSON parseado. Lanza MetaApiError
 * (ya clasificado) ante error. Reintenta con backoff solo si es transitorio.
 *
 * @param path  Ruta relativa a la base, ej. `/{igId}/media` o una URL absoluta
 *              de paginación (paging.next).
 */
export async function metaFetch<T = unknown>(
  path: string,
  opts: MetaFetchOptions,
): Promise<GraphResponse<T>> {
  const { token, params = {}, maxRetries = 2, timeoutMs = 20000 } = opts;

  // Si path ya es una URL absoluta (paging.next), respetarla; si no, construir.
  const isAbsolute = path.startsWith('http://') || path.startsWith('https://');
  const url = new URL(isAbsolute ? path : `${GRAPH_BASE}${path.startsWith('/') ? path : `/${path}`}`);
  if (!isAbsolute) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    url.searchParams.set('access_token', token);
  }

  let lastErr: MetaApiError | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let res: Response;
    try {
      res = await fetch(url.toString(), { signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      // Error de red/timeout = transitorio. Reintentar.
      lastErr = new MetaApiError(
        e instanceof Error ? e.message : 'network_error',
        'server',
        0,
      );
      if (attempt < maxRetries) { await backoff(attempt); continue; }
      throw lastErr;
    }

    const body = (await res.json().catch(() => ({}))) as GraphResponse<T>;

    if (res.ok && !body.error) return body;

    const kind = classifyMetaError(body.error, res.status);
    const err = new MetaApiError(
      body.error?.message ?? `Graph HTTP ${res.status}`,
      kind,
      res.status,
      body.error,
    );

    if (err.retryable && attempt < maxRetries) {
      lastErr = err;
      await backoff(attempt, res.headers.get('retry-after'));
      continue;
    }
    throw err;
  }
  // Inalcanzable salvo que maxRetries<0; por las dudas:
  throw lastErr ?? new MetaApiError('meta_fetch_failed', 'client', 0);
}

/**
 * Itera todas las páginas de un endpoint de Graph y concatena los `data`.
 * Encapsula el `while(url){...; url=paging.next}` duplicado en sync-instagram.
 */
export async function metaFetchPaged<Item = unknown>(
  path: string,
  opts: MetaFetchOptions,
): Promise<Item[]> {
  const out: Item[] = [];
  const first = await metaFetch<Item[]>(path, opts);
  if (Array.isArray(first.data)) out.push(...first.data);
  let next = first.paging?.next ?? null;
  // Las páginas siguientes ya traen el access_token embebido en la URL.
  while (next) {
    const page = await metaFetch<Item[]>(next, { ...opts });
    if (Array.isArray(page.data)) out.push(...page.data);
    next = page.paging?.next ?? null;
  }
  return out;
}

/** Backoff exponencial con jitter. Budget corto (apto para edge ~120-150s). */
async function backoff(attempt: number, retryAfter?: string | null): Promise<void> {
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (!Number.isNaN(secs) && secs > 0) { await sleep(Math.min(secs * 1000, 10000)); return; }
  }
  const base = 1500 * Math.pow(2, attempt); // 1.5s, 3s
  const jitter = base * 0.25 * Math.random();
  await sleep(Math.min(base + jitter, 10000));
}
