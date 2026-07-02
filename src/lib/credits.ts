/**
 * Moka Coins — helpers puros (isomórficos: server + cliente).
 *
 * Peg: 1 Moka Coin = $0.001 USD  =>  coins = round(cost_usd * 1000).
 * El allotment por tier vive en TIER_CONFIG (dailyCoins). Acá solo van las
 * conversiones y el "reset diario en lectura" alineado al huso AR (la DB
 * hace el mismo cálculo en el trigger; ver 20260701000000_moka_coins_v1.sql).
 */

import { dailyCoins, type Tier } from '@/lib/tier/config';

export const MC_PER_USD = 1000;

/** USD → Moka Coins (mismo redondeo que el trigger de la DB). */
export const usdToCoins = (usd: number): number => Math.round((usd || 0) * MC_PER_USD);

/** Huso de negocio: el reset del contador coincide con la medianoche AR. */
export const AR_TZ = 'America/Argentina/Buenos_Aires';

// ─── Buckets de costo ────────────────────────────────────────────────────────

export type CreditBucket = 'ai' | 'scraping' | 'service' | 'system';

/**
 * ESPEJO de public.credit_category() en la DB (migración 20260702000200) —
 * mantener SINCRONIZADAS a mano. La usa el admin para agrupar reportes sin
 * pegarle a la RPC por cada fila. 'ai' y 'scraping' DEBITAN la billetera del
 * cliente; 'service' y 'system' los absorbe Moka. Desconocido => 'system'.
 */
export function creditCategory(feature: string): CreditBucket {
  switch (feature) {
    case 'ai-agents':
    case 'ai-agents-light':
    case 'ai-agents-specialist':
    case 'onboarding-adn':
    case 'competitor-analysis':
    case 'reference-analysis':
    case 'arkoai-video-analysis':
    case 'reel-auto-title':
    case 'hooks-classify':
      return 'ai';
    case 'reel-analysis-rescrape':
      return 'scraping';
    case 'competitor-base-load':
    case 'competitor-scheduled-refresh':
    case 'reference-base-load':
    case 'competitor-scraping':   // legacy
    case 'reference-scraping':    // legacy
      return 'service';
    default:
      return 'system';
  }
}

/** ¿El bucket debita la billetera del cliente? */
export const bucketDebits = (b: CreditBucket) => b === 'ai' || b === 'scraping';

/** Fecha "de hoy" en huso AR como 'YYYY-MM-DD' (en-CA da formato ISO). */
export function arToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: AR_TZ });
}

/** Fila de balance leída de workspace_credit_balances (campos usados por la UI/guard). */
export interface CreditBalanceRow {
  period_date: string;
  spent_today_coins: number;
  /** Override admin: monedas infinitas. */
  unlimited?: boolean | null;
  /** Override admin: cupo diario extra sumado al allotment del tier. */
  bonus_daily_coins?: number | null;
}

/**
 * Gastado hoy aplicando el reset en LECTURA: si la fila de balance quedó de un
 * día anterior (el trigger todavía no la tocó hoy), el gastado efectivo es 0.
 */
export function spentTodayCoins(row: CreditBalanceRow | null | undefined): number {
  if (!row) return 0;
  return row.period_date === arToday() ? row.spent_today_coins : 0;
}

/** Estado efectivo de la billetera (allotment del tier + overrides de admin). */
export interface CreditView {
  unlimited: boolean;
  /** Cupo diario efectivo (Infinity si unlimited). */
  allotment: number;
  spent: number;
  /** Coins restantes hoy (Infinity si unlimited). */
  remaining: number;
}

/**
 * Fuente única de verdad del "cuánto le queda": allotment del tier + bonus del
 * admin, o infinito si el admin marcó unlimited. La consumen el chip, el banner
 * y el guard, así los tres respetan los overrides sin duplicar lógica.
 */
export function creditView(tier: Tier, row: CreditBalanceRow | null | undefined): CreditView {
  const spent = spentTodayCoins(row);
  if (row?.unlimited) {
    return { unlimited: true, allotment: Infinity, spent, remaining: Infinity };
  }
  const allotment = dailyCoins(tier) + (row?.bonus_daily_coins ?? 0);
  return { unlimited: false, allotment, spent, remaining: Math.max(0, allotment - spent) };
}
