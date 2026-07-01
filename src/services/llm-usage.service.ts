/**
 * llm-usage.service.ts
 * Tracks LLM token usage and calculates costs per call.
 * Costs are stored in USD per 1M tokens (input/output priced separately).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMResponse } from './llm.service';
import type { LLMFeature } from './llm-config';

// ─── Pricing per 1M tokens (USD) ───────────────────────────────────────────

interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI
  'gpt-4.1-mini':           { inputPer1M: 0.40,  outputPer1M: 1.60 },
  'gpt-4.1':                { inputPer1M: 2.00,  outputPer1M: 8.00 },
  'gpt-4.1-nano':           { inputPer1M: 0.10,  outputPer1M: 0.40 },
  'gpt-4o':                 { inputPer1M: 2.50,  outputPer1M: 10.00 },
  'gpt-4o-mini':            { inputPer1M: 0.15,  outputPer1M: 0.60 },
  // Anthropic (IDs vigentes — claude-haiku-4-5 matchea por prefijo a claude-haiku-4-5-20251001)
  'claude-sonnet-4-6':           { inputPer1M: 3.00,  outputPer1M: 15.00 },
  'claude-haiku-4-5':            { inputPer1M: 1.00,  outputPer1M: 5.00 },
  // Legacy (retirados por Anthropic — se dejan para costear usage histórico ya logueado)
  'claude-sonnet-4-20250514':    { inputPer1M: 3.00,  outputPer1M: 15.00 },
  'claude-3-5-haiku-20241022':   { inputPer1M: 0.80,  outputPer1M: 4.00 },
  'claude-opus-4-20250514':      { inputPer1M: 15.00, outputPer1M: 75.00 },
  // Google
  'gemini-2.5-pro':              { inputPer1M: 1.25,  outputPer1M: 10.00 }, // tier-up de video (≤200k ctx). Verificar vs precio vivo de Google.
  'gemini-2.5-flash':            { inputPer1M: 0.15,  outputPer1M: 0.60 },
  'gemini-2.0-flash':            { inputPer1M: 0.10,  outputPer1M: 0.40 },
  'gemini-1.5-flash':            { inputPer1M: 0.075, outputPer1M: 0.30 },
};

function findPricing(model: string): ModelPricing | null {
  // Exact match first
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];

  // Fuzzy match: OpenAI returns "gpt-4.1-mini-2025-04-14" but we store "gpt-4.1-mini"
  // Try matching by prefix (longest match wins)
  let bestMatch: ModelPricing | null = null;
  let bestLength = 0;
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.startsWith(key) && key.length > bestLength) {
      bestMatch = pricing;
      bestLength = key.length;
    }
  }
  // Sin pricing => cost_usd=0 => 0 Moka Coins (gasto invisible). Avisar para que
  // un cambio de modelo no regrese en silencio a "gratis" (así se detectó gemini-2.5-pro).
  if (!bestMatch) console.warn(`[llm-usage] Modelo SIN pricing: "${model}" → cost_usd=0. Agregar a MODEL_PRICING.`);
  return bestMatch;
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = findPricing(model);
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return Number((inputCost + outputCost).toFixed(6));
}

// ─── Log usage to DB ────────────────────────────────────────────────────────

export async function logLLMUsage(
  supabase: SupabaseClient,
  params: {
    workspaceId: string;
    userId: string;
    feature: LLMFeature;
    response: LLMResponse;
    latencyMs?: number;
  }
): Promise<void> {
  const { workspaceId, userId, feature, response, latencyMs } = params;

  const costUsd = calculateCost(response.model, response.inputTokens, response.outputTokens);

  const { error } = await supabase.from('llm_usage').insert({
    workspace_id: workspaceId,
    user_id: userId,
    feature,
    provider: response.provider,
    model: response.model,
    input_tokens: response.inputTokens,
    output_tokens: response.outputTokens,
    total_tokens: response.totalTokens,
    cost_usd: costUsd,
    latency_ms: latencyMs ?? null,
  });
  if (error) console.error('[llm-usage] insert error:', error);
}
