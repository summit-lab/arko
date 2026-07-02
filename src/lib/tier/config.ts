/**
 * Tier entitlements — fuente ÚNICA de verdad del sistema de 3 tiers
 * (demo / standard / pro). Todos los límites y el acceso a features viven acá;
 * en la DB solo se guarda `workspaces.plan` + `trial_ends_at`.
 *
 * Mapeo comercial (1:1): demo = lead, standard = "Free Trial" (con countdown),
 * pro = "Full" (pago). Etiquetas visibles en TIER_LABEL.
 *
 * Pura: sin I/O, sin React. La consumen auth.ts (resolveTier), guard.ts
 * (hasFeature), layout/Sidebar (UI), instagram/page (ownReelsCap) y, en
 * [FASE 2], el budget-guard (dailyBudget) y los clamps.
 */

export type Tier = 'demo' | 'standard' | 'pro';

export type Feature =
  | 'competitors'
  | 'audience'
  | 'sales'
  | 'worktable'
  | 'mokaAI'
  | 'youtube'
  | 'ads'
  | 'reelAiAnalysis';

export interface TierConfig {
  dailyBudgetUsd: number; // cap diario Moka Coins = llm_usage + integration_usage (×1000 = coins)
  maxCompetitors: number; // tope de competidores seguibles (cada uno = costo de cron perpetuo)
  maxReelsPerScrape: number; // tope de reels por scrape manual de competidor
  maxBulkAnalyze: number; // tope de tandas de análisis IA encadenadas (×5 reels c/u)
  scrapeWindowDays: number; // ventana máx de reels a scrapear de un competidor
  ownReelsCap: number; // FASE 1: tope de reels propios visibles en el dashboard
  features: Record<Feature, boolean>;
}

// youtube: false para TODOS los tiers (2026-07-02, decisión del dueño):
// la conexión a YouTube se retira del producto — no visible en ningún plan.
// Las rutas API con requireFeature('youtube') devuelven 403 y /youtube
// muestra el lock si alguien entra por URL directa. El item del Sidebar se
// removió. Para revivirla: youtube: true + restaurar el item del Sidebar.
const ALL_ON: Record<Feature, boolean> = {
  competitors: true, audience: true, sales: true, worktable: true,
  mokaAI: true, youtube: false, ads: true, reelAiAnalysis: true,
};
const ALL_OFF: Record<Feature, boolean> = {
  competitors: false, audience: false, sales: false, worktable: false,
  mokaAI: false, youtube: false, ads: false, reelAiAnalysis: false,
};

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  // Demo "con probada" (2026-07-02): reelAiAnalysis ON — puede analizar SUS
  // reels con Gemini, generar títulos y chatear con Moka DENTRO de un reel
  // (el chat general/ADN siguen off vía mokaAI). El gasto lo asume Moka pero
  // está capado DURO: assertCredits fuerza hard-gate para tier demo aunque
  // CREDITS_HARD_GATE global esté off → máx 150 coins = $0.15/día por demo.
  demo:     { dailyBudgetUsd: 0.15, maxCompetitors: 0, maxReelsPerScrape: 0,   maxBulkAnalyze: 0, scrapeWindowDays: 0,  ownReelsCap: 12,  features: { ...ALL_OFF, reelAiAnalysis: true } },
  standard: { dailyBudgetUsd: 0.50, maxCompetitors: 3, maxReelsPerScrape: 20,  maxBulkAnalyze: 3, scrapeWindowDays: 30, ownReelsCap: 200, features: ALL_ON },
  // Pro 1000 coins/día ($1): entran ~3 análisis profundos (techo 300c c/u) + chat normal.
  pro:      { dailyBudgetUsd: 1.00, maxCompetitors: 5, maxReelsPerScrape: 100, maxBulkAnalyze: 5, scrapeWindowDays: 90, ownReelsCap: 200, features: ALL_ON },
};

/** Etiquetas visibles. La DB mantiene los valores canónicos demo/standard/pro. */
export const TIER_LABEL: Record<Tier, string> = {
  demo: 'Demo',
  standard: 'Free Trial',
  pro: 'Full',
};

export const cfg = (t: Tier) => TIER_CONFIG[t];
export const hasFeature = (t: Tier, f: Feature) => TIER_CONFIG[t].features[f];
export const dailyBudget = (t: Tier) => TIER_CONFIG[t].dailyBudgetUsd;
/** Allotment diario de Moka Coins = dailyBudgetUsd × 1000 (1 MC = $0.001). */
export const dailyCoins = (t: Tier) => Math.round(TIER_CONFIG[t].dailyBudgetUsd * 1000);
export const clampReels = (t: Tier, n: number) => Math.min(n, TIER_CONFIG[t].maxReelsPerScrape);
export const clampCompetitors = (t: Tier, n: number) => Math.min(n, TIER_CONFIG[t].maxCompetitors);

/**
 * AUTO-DOWNGRADE lazy: un standard con trial vencido se trata como demo,
 * sin tocar la DB. Fail-closed ante valores nulos/desconocidos.
 */
export function resolveTier(plan: string | null, trialEndsAt: string | null): Tier {
  if (plan === 'pro') return 'pro';
  if (plan === 'standard') {
    if (!trialEndsAt) return 'standard';
    const end = new Date(trialEndsAt);
    // Fail-closed: fecha inválida → tratar como vencido (demo).
    return Number.isNaN(end.getTime()) || end < new Date() ? 'demo' : 'standard';
  }
  return 'demo';
}

/**
 * Feature asociada a un item del Sidebar (href + tab). null = sin gate
 * (Dashboard, Reels, Historias, Publicaciones = contenido propio, gratis).
 */
export function navFeature(href: string, tab?: string | null): Feature | null {
  if (href === '/instagram') {
    if (tab === 'competencia') return 'competitors';
    if (tab === 'metrics') return 'audience';
    return null; // reels, historias, publicaciones
  }
  switch (href) {
    case '/ventas': return 'sales';
    case '/mesa-de-trabajo': return 'worktable';
    case '/agents': return 'mokaAI';
    case '/youtube': return 'youtube';
    case '/ads': return 'ads';
    case '/settings/adn': return 'mokaAI';
    default: return null;
  }
}

/** Texto EXACTO del pop-up trampa del Demo (confirmado con el usuario). */
export const TRAP = {
  title: 'Este plan no está disponible.',
  description: 'Comunicate con nuestro equipo para acceder a un plan premium con todas las funciones.',
  ctaText: 'Volver al dashboard',
  ctaHref: '/',
} as const;
