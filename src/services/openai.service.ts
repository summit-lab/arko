/**
 * openai.service.ts
 * OpenAI Chat Completions provider for the unified LLM service.
 * Uses fetch directly (no SDK dependency).
 */

import type { LLMOptions, LLMResponse, LLMToolCall } from './llm.service';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// ─── OpenAI-specific types ──────────────────────────────────────────────────

interface OpenAIFunctionCall {
  name: string;
  arguments: string;
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: OpenAIFunctionCall;
}

interface OpenAIChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

interface OpenAIResponse {
  id: string;
  object: string;
  model: string;
  choices: OpenAIChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ─── Convert our universal tool format to OpenAI function format ────────────

function toOpenAITools(tools: LLMOptions['tools']) {
  if (!tools || tools.length === 0) return undefined;

  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

// ─── Main function ──────────────────────────────────────────────────────────

export async function callOpenAI(options: LLMOptions): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const { messages, system, tools, maxTokens = 2048, model } = options;

  // OpenAI uses a system message in the messages array
  const openaiMessages = [
    { role: 'system' as const, content: system },
    ...messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: openaiMessages,
  };

  const openaiTools = toOpenAITools(tools);
  if (openaiTools) {
    body.tools = openaiTools;
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as OpenAIResponse;
  const choice = data.choices[0];

  if (!choice) {
    throw new Error('OpenAI returned no choices');
  }

  // Extract text and tool calls
  const text = choice.message.content ?? '';
  const toolCalls: LLMToolCall[] = (choice.message.tool_calls ?? []).map(
    (tc) => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    })
  );

  return {
    text,
    toolCalls,
    inputTokens: data.usage.prompt_tokens,
    outputTokens: data.usage.completion_tokens,
    totalTokens: data.usage.total_tokens,
    stopReason: choice.finish_reason,
    model: data.model,
    provider: 'openai',
  };
}
