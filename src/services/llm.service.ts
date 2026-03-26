/**
 * llm.service.ts
 * Unified LLM interface for all AI features in Arko.
 * Abstracts provider (Anthropic, OpenAI) behind a single callLLM() function.
 * Each feature specifies which model to use via llm-config.ts.
 */

// ─── Shared Types ───────────────────────────────────────────────────────────

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LLMToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LLMResponse {
  text: string;
  toolCalls: LLMToolCall[];
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  stopReason: string;
  model: string;
  provider: LLMProvider;
}

export type LLMProvider = 'anthropic' | 'openai' | 'google';

export interface LLMOptions {
  provider: LLMProvider;
  model: string;
  messages: LLMMessage[];
  system: string;
  tools?: LLMTool[];
  maxTokens?: number;
}

// ─── Provider implementations ───────────────────────────────────────────────

import { callAnthropic } from './anthropic.service';
import { callOpenAI } from './openai.service';

// ─── Main entry point ───────────────────────────────────────────────────────

export async function callLLM(options: LLMOptions): Promise<LLMResponse> {
  switch (options.provider) {
    case 'anthropic':
      return callAnthropic(options);
    case 'openai':
      return callOpenAI(options);
    default:
      throw new Error(`Unknown LLM provider: ${options.provider}`);
  }
}
