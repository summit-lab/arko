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
  };
}

// ─── Main function ──────────────────────────────────────────────────────────

export async function callAnthropic(options: LLMOptions): Promise<LLMResponse> {
  const apiKey = getAnthropicKey();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const { messages, system, tools, maxTokens = 2048, model } = options;

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    system,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
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

  return {
    text,
    toolCalls,
    inputTokens: data.usage.input_tokens,
    outputTokens: data.usage.output_tokens,
    totalTokens: data.usage.input_tokens + data.usage.output_tokens,
    stopReason: data.stop_reason,
    model: data.model,
    provider: 'anthropic',
  };
}
