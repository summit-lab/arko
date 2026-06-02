/**
 * follower-metrics — saneamiento de anomalías de seguidores.
 *
 * Instagram a veces devuelve datos imposibles cuando una cuenta es suspendida
 * y reactivada (o ante glitches de la Graph API): el `follower_count` diario
 * reporta de golpe TODOS los seguidores recuperados (ej. +6615, +30864 en un
 * solo día) y el `followers_total` acumulado cae a ~0 durante la suspensión y
 * rebota después. Sin sanear, el dashboard dibuja "+6600 seguidores en un día"
 * y los KPIs de crecimiento se inflan.
 *
 * Este módulo NO toca la base de datos: los valores reales de Meta se conservan
 * (sirven para soporte/auditoría). Solo SANEA la serie en el momento de leerla
 * para mostrarla. Es la capa de lectura; el escritor (edge function) se endurece
 * por separado en una fase posterior.
 *
 * Regla (validada contra datos reales de Prod):
 *  - Umbral adaptativo por ventana = max(ABS_FLOOR, MULT × mediana de deltas>0).
 *    La mediana es robusta (el propio outlier no la mueve); el piso absoluto
 *    protege cuentas chicas. Ej: mediana 36 → umbral 500 (filtra 6615, deja 248);
 *    mediana 177 → umbral 1416 (filtra 30864, deja 714). El crecimiento sostenido
 *    sube la mediana → sube el techo, así que NO esconde crecimiento legítimo;
 *    solo cae el pico AISLADO de recuperación/glitch.
 *  - followers_total: se marca el "valle" de suspensión (colapso + rebote) y se
 *    excluye de los diffs lastFt−firstFt y del snapshot de total.
 */

/** Piso absoluto del umbral de delta diario (protege cuentas chicas). */
export const FOLLOWER_DELTA_ABS_FLOOR = 500;
/** Múltiplo sobre la mediana para el umbral adaptativo. */
export const FOLLOWER_DELTA_MULT = 8;
/** followers_total por debajo de este % de la mediana = candidato a "valle" de suspensión. */
export const FOLLOWERS_TOTAL_COLLAPSE_RATIO = 0.3;
/** Rebote posterior por encima de este múltiplo del valle = confirma suspensión. */
export const FOLLOWERS_TOTAL_REBOUND_RATIO = 1.5;

export interface InsightRow {
  metric_date: string;
  follower_count: number | null;
  followers_total: number | null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Umbral adaptativo de delta diario para una ventana de filas.
 * Un follower_count > umbral se considera anómalo (recuperación/glitch).
 */
export function computeFollowerThreshold(rows: InsightRow[]): number {
  const positiveDeltas = rows
    .map((r) => r.follower_count ?? 0)
    .filter((d) => d > 0);
  return Math.max(FOLLOWER_DELTA_ABS_FLOOR, FOLLOWER_DELTA_MULT * median(positiveDeltas));
}

export interface SanitizedDelta {
  metric_date: string;
  /** follower_count saneado: 0 si el día es anómalo, el valor real si no. */
  newFollowers: number;
  isAnomaly: boolean;
}

/**
 * Sanea la serie de deltas diarios (PARTE 1). Mantiene todos los puntos en el
 * eje temporal pero clampea a 0 los días anómalos y los marca con isAnomaly.
 */
export function sanitizeDailyFollowerDeltas(rows: InsightRow[]): SanitizedDelta[] {
  const threshold = computeFollowerThreshold(rows);
  return rows.map((r) => {
    const raw = r.follower_count ?? 0;
    const isAnomaly = raw > threshold;
    return {
      metric_date: r.metric_date,
      newFollowers: isAnomaly ? 0 : raw,
      isAnomaly,
    };
  });
}

/** Suma de deltas diarios excluyendo los días anómalos (PARTE 1). */
export function sumCleanFollowerDeltas(rows: InsightRow[]): number {
  return sanitizeDailyFollowerDeltas(rows).reduce((s, r) => s + r.newFollowers, 0);
}

/**
 * Detecta fechas en el "valle" de una suspensión (PARTE 2): días cuyo
 * followers_total colapsa muy por debajo de la mediana de la ventana y que
 * están rodeados/seguidos por valores normales (rebote). Esos días NO deben
 * usarse para diffs ni snapshots.
 */
export function detectFollowersTotalAnomalies(rows: InsightRow[]): Set<string> {
  const anomalies = new Set<string>();
  const totals = rows
    .map((r) => r.followers_total ?? 0)
    .filter((t) => t > 0);
  if (totals.length < 3) return anomalies; // muy pocos datos para juzgar

  const med = median(totals);
  if (med <= 0) return anomalies;

  const collapseLevel = med * FOLLOWERS_TOTAL_COLLAPSE_RATIO;

  // Un día es "valle" si su followers_total está colapsado Y existe algún día
  // posterior que rebota muy por encima de ese valor colapsado (firma de
  // suspensión seguida de recuperación).
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i].followers_total ?? 0;
    if (t <= 0 || t >= collapseLevel) continue;
    const reboundsLater = rows
      .slice(i + 1)
      .some((later) => (later.followers_total ?? 0) > t * FOLLOWERS_TOTAL_REBOUND_RATIO && (later.followers_total ?? 0) >= collapseLevel);
    if (reboundsLater) anomalies.add(rows[i].metric_date);
  }
  return anomalies;
}

/**
 * Devuelve la serie de filas excluyendo los días en valle de suspensión.
 * Úsese para alimentar firstFt/lastFt, snapshots de total y curvas de acumulado.
 * Genérico: preserva el tipo concreto de entrada (ej. DayInsight), no lo reduce
 * a InsightRow.
 */
export function cleanFollowersTotalSeries<T extends InsightRow>(rows: T[]): T[] {
  const anomalies = detectFollowersTotalAnomalies(rows);
  if (anomalies.size === 0) return rows;
  return rows.filter((r) => !anomalies.has(r.metric_date));
}

/**
 * Último followers_total "sano" de la serie (excluye días en valle de
 * suspensión). Para el snapshot de "total de seguidores" del header/dashboard.
 * Asume que `rows` puede venir en cualquier orden; toma el de metric_date mayor.
 */
export function latestCleanFollowersTotal(rows: InsightRow[]): number {
  const clean = cleanFollowersTotalSeries(rows).filter((r) => (r.followers_total ?? 0) > 0);
  if (clean.length === 0) return 0;
  const latest = clean.reduce((a, b) => (a.metric_date >= b.metric_date ? a : b));
  return latest.followers_total ?? 0;
}
