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

const OPERATION_PRICING: Record<string, OperationPricing> = {
  'reel-scrape': { perCall: 0.0033 },        // $0.0023 reel + $0.001 actor start
  'competitor-profile-scrape': { perCall: 0.01 },  // Apify profile scraper per profile
  'competitor-reel-scrape': { perCall: 0.0039 },   // $0.0033 reel + $0.006 shares count per reel
  'competitor-grid-scrape': { perCall: 0.0025 },   // Apify post-scraper por post del grid (trial detection). Antes: costo 100% invisible (~$0.50/scrape).
};

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
  } = params;

  const costUsd = getOperationCost(operation, itemsCount);

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
