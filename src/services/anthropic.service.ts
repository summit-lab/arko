/**
 * anthropic.service.ts
 * Anthropic Messages API provider for the unified LLM service.
 * Uses fetch directly (no SDK dependency).
 */

import type { LLMOptions, LLMResponse, LLMToolCall } from './llm.service';
import { getAnthropicKey } from '@/lib/env';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// ─── Anthropic-specific types ───────────────────────────────────────────────

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock;

interface AnthropicApiResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage: {
    input_tokens: number;
    output_tokens: number;
    /** Tokens escritos al prompt cache (se facturan a 1.25×). */
    cache_creation_input_tokens?: number;
    /** Tokens leídos del prompt cache (se facturan a 0.1×). */
    cache_read_input_tokens?: number;
  };
}

// ─── Main function ──────────────────────────────────────────────────────────

export async function callAnthropic(options: LLMOptions): Promise<LLMResponse> {
  const apiKey = getAnthropicKey();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const { messages, system, tools, maxTokens = 2048, model } = options;

  // PROMPT CACHING (reduce ~85-90% del costo de input en iteraciones del tool
  // loop y mensajes seguidos de una sesión):
  //  - cache_control en el bloque system → cachea tools + system prompt
  //    (~10k tokens estáticos que antes se re-pagaban a precio full en CADA
  //    iteración de CADA mensaje).
  //  - cache_control en el último mensaje → cachea el prefijo completo de la
  //    conversación (historia + tool results de iteraciones previas).
  // Requisito: el system prompt no debe embeber timestamps/aleatoriedad (hoy
  // no lo hace) — si cambia byte a byte, el cache no pega.
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    system: [
      { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
    ],
    messages: messages.map((m, i) => ({
      role: m.role,
      content: i === messages.length - 1
        ? [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }]
        : m.content,
    })),
  };

  if (tools && tools.length > 0) {
    body.tools = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as AnthropicApiResponse;

  // Extract text content and tool calls
  let text = '';
  const toolCalls: LLMToolCall[] = [];

  for (const block of data.content) {
    if (block.type === 'text') {
      text += block.text;
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        name: block.name,
        input: block.input,
      });
    }
  }

  // Facturación honesta con caching: `input_tokens` de la API EXCLUYE los
  // tokens cacheados. Cache write = 1.25× tarifa, cache read = 0.1×. Plegamos
  // ambos a "tokens de input equivalentes" para que calculateCost() (tarifa
  // plana por token) dé el USD real y las Moka Coins debiten lo justo.
  const cacheCreation = data.usage.cache_creation_input_tokens ?? 0;
  const cacheRead = data.usage.cache_read_input_tokens ?? 0;
  const effectiveInputTokens = Math.round(
    data.usage.input_tokens + cacheCreation * 1.25 + cacheRead * 0.1,
  );

  return {
    text,
    toolCalls,
    inputTokens: effectiveInputTokens,
    outputTokens: data.usage.output_tokens,
    totalTokens: effectiveInputTokens + data.usage.output_tokens,
    stopReason: data.stop_reason,
    model: data.model,
    provider: 'anthropic',
  };
}
