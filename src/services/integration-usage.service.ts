/**
 * integration-usage.service.ts
 * Tracks external integration API calls and calculates costs.
 * Parallel to llm-usage.service.ts but for non-LLM services.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Pricing per call (USD) ────────────────────────────────────────────────

interface OperationPricing {
  perCall: number;
}

// Tarifas del plan Apify STARTER (tier BRONZE, API de Apify 2026-11-08; las
// anteriores de SCALE se habían VERIFICADO contra cargos reales,
// runs del 2026-07-01: 86 reels+shares = $0.5514 exacto; 1 reel = $0.0024;
// perfil = $0.002). Si el plan de Apify cambia, re-verificar contra
// usageTotalUsd de runs reales — NO contra el pricing publicado del Store.
const OPERATION_PRICING: Record<string, OperationPricing> = {
  'reel-scrape': { perCall: 0.0033 },              // 1 reel: $0.0023 + $0.001 actor-start
  'competitor-profile-scrape': { perCall: 0.0023 }, // perfil (sin start fee)
  'competitor-reel-scrape': { perCall: 0.0083 },   // $0.0023 reel + $0.006 shares add-on (scrape manual)
  'competitor-grid-scrape': { perCall: 0.0015 },   // post del grid (trial detection, sin start fee)
};

/** Costo real de un run de Apify que falló/devolvió 0 items: el actor-start
 *  se cobra igual si el run arrancó (un ABORTED llegó a cobrar el run entero). */
export const APIFY_FAILED_RUN_USD = 0.001;

function getOperationCost(operation: string, itemsCount: number): number {
  const pricing = OPERATION_PRICING[operation];
  if (!pricing) return 0;
  return Number((pricing.perCall * itemsCount).toFixed(6));
}

// ─── Log usage to DB ────────────────────────────────────────────────────────

export type IntegrationStatus = 'success' | 'error' | 'timeout';

export async function logIntegrationUsage(
  supabase: SupabaseClient,
  params: {
    workspaceId: string;
    userId: string;
    feature: string;
    provider: string;
    operation: string;
    itemsCount?: number;
    latencyMs?: number;
    status?: IntegrationStatus;
    metadata?: Record<string, unknown>;
    /** Override del costo calculado por items (ej. APIFY_FAILED_RUN_USD para
     *  runs con error: items=0 pero el actor-start se cobró igual). */
    costUsdOverride?: number;
  }
): Promise<void> {
  const {
    workspaceId,
    userId,
    feature,
    provider,
    operation,
    itemsCount = 1,
    latencyMs,
    status = 'success',
    metadata = {},
    costUsdOverride,
  } = params;

  const costUsd = costUsdOverride ?? getOperationCost(operation, itemsCount);

  const { error } = await supabase.from('integration_usage').insert({
    workspace_id: workspaceId,
    user_id: userId,
    feature,
    provider,
    operation,
    items_count: itemsCount,
    cost_usd: costUsd,
    latency_ms: latencyMs ?? null,
    status,
    metadata,
  });
  if (error) console.error('[integration-usage] insert error:', error);
}
