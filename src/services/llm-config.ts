/**
 * llm-config.ts
 * Maps each Arko AI feature to its preferred LLM provider + model.
 * Change the model here to switch providers without touching feature code.
 */

import type { LLMProvider } from './llm.service';

interface LLMFeatureConfig {
  provider: LLMProvider;
  model: string;
  maxTokens: number;
}

/**
 * Feature-to-model mapping.
 * To switch a feature to a different provider/model, change only this config.
 */
const LLM_CONFIG = {
  /** ADN de Comunicación onboarding chat — conversación guiada, extracción simple */
  'onboarding-adn': {
    provider: 'openai' as LLMProvider,
    model: 'gpt-4.1-mini',
    maxTokens: 1024,
  },

  /** AI Agents — análisis profundo con tool_use (métricas, ideas, guiones) */
  'ai-agents': {
    provider: 'anthropic' as LLMProvider,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
  },

  /** AI Agents light — preguntas simples, saludos, dudas sobre ADN (sin tools) */
  'ai-agents-light': {
    provider: 'openai' as LLMProvider,
    model: 'gpt-4.1-mini',
    maxTokens: 2048,
  },

  /** Reel diagnostics — análisis profundo de métricas y contenido */
  'reel-diagnostics': {
    provider: 'anthropic' as LLMProvider,
    model: 'claude-3-5-haiku-20241022',
    maxTokens: 2048,
  },

  /** Métricas y análisis general — interpretación de datos, benchmarks */
  'metrics-analysis': {
    provider: 'anthropic' as LLMProvider,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
  },
  /** ArkoAI video analysis — Gemini analiza video completo (visual + audio + transcript) */
  'arkoai-video-analysis': {
    provider: 'google' as LLMProvider,
    model: 'gemini-2.5-flash',
    maxTokens: 8192,
  },
  /** Competitor reel analysis — Gemini analiza reels de competidores (video completo) */
  'competitor-analysis': {
    provider: 'google' as LLMProvider,
    model: 'gemini-2.5-flash',
    maxTokens: 8192,
  },

  /** Reference reel analysis — Gemini analiza reels de referencias inspiradoras (caption-only) */
  'reference-analysis': {
    provider: 'google' as LLMProvider,
    model: 'gemini-2.5-flash',
    maxTokens: 1024,
  },

  /** Reel auto-title — genera título corto (≤60 chars) a partir de la transcripción */
  'reel-auto-title': {
    provider: 'anthropic' as LLMProvider,
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 128,
  },
} as const satisfies Record<string, LLMFeatureConfig>;

export type LLMFeature = keyof typeof LLM_CONFIG;

export function getLLMConfig(feature: LLMFeature): LLMFeatureConfig {
  return LLM_CONFIG[feature];
}
