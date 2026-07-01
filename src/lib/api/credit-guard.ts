/**
 * Corte de gasto por Moka Coins (hard-gate opcional).
 *
 * Lanzamiento = SOFT: `CREDITS_HARD_GATE` sin setear → assertCredits es un
 * no-op (ni siquiera consulta la DB). El chip + banner dan visibilidad, pero no
 * se bloquea a nadie. Cuando los números reales estén calibrados, se prende
 * `CREDITS_HARD_GATE=true` (1 variable de entorno) y este guard empieza a
 * cortar acciones pagas al agotarse el allotment diario.
 *
 * Va DESPUÉS de requireFeature() en las rutas caras (chat, análisis de video,
 * scrapes manuales). El balance se lee bajo la sesión RLS del caller
 * (is_workspace_member pasa para el dueño).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthResult } from './auth';
import { api403 } from './response';
import { creditView, type CreditBalanceRow } from '@/lib/credits';

const HARD_GATE = process.env.CREDITS_HARD_GATE === 'true';

/**
 * Devuelve un 403 si el workspace se quedó sin Moka Coins por hoy (solo con el
 * hard-gate encendido). Devuelve null si puede seguir (o si el gate está soft).
 */
export async function assertCredits(
  supabase: SupabaseClient,
  auth: AuthResult,
): Promise<Response | null> {
  if (!HARD_GATE) return null; // modo soft / visibilidad

  const { data } = await supabase
    .from('workspace_credit_balances')
    .select('period_date, spent_today_coins, unlimited, bonus_daily_coins')
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle();

  const view = creditView(auth.tier, data as CreditBalanceRow | null);
  if (view.remaining <= 0) {
    return api403('Te quedaste sin Moka Coins por hoy. Se renuevan a la medianoche.');
  }
  return null;
}
