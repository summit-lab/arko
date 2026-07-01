/**
 * Moka Coins — estimaciones estáticas por acción ("previsto" pre-acción).
 *
 * Puras, sin I/O (mismo patrón que src/lib/credits.ts). Anclas medidas en Prod
 * (2026-07-01, post caching/techo): sirven para el hint "~X Moka" en los
 * botones de acciones caras. La verdad del débito siempre la pone el trigger
 * de la DB sobre el costo real; esto es SOLO UX.
 */

export interface ActionEstimate {
  /** Coins típicas de la acción. */
  typ: number;
  /** Techo razonable (para el tooltip "hasta ~X"). */
  max: number;
}

export const ACTION_ESTIMATES = {
  /** Mensaje de chat complejo (sesiones de reel/guion/Mesa fuerzan complex).
   *  max = MAX_COINS_PER_MESSAGE del route (techo duro server-side). */
  'chat-complex':        { typ: 50, max: 300 },
  'chat-simple':         { typ: 1,  max: 9 },
  /** Análisis de video propio (Gemini flash; max = tier-up a pro). */
  'video-analysis':      { typ: 5,  max: 75 },
  /** Analizar competidor: el SCRAPE es servicio (0 coins) — esto es solo la IA. */
  'competitor-analysis': { typ: 30, max: 100 },
  'reference-analysis':  { typ: 2,  max: 10 },
} as const satisfies Record<string, ActionEstimate>;

export type EstimableAction = keyof typeof ACTION_ESTIMATES;
