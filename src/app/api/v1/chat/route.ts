/**
 * POST /api/v1/chat
 * Arko AI — unified analytical chat with tool_use.
 * Uses Server-Sent Events (SSE) to stream progress updates to the client.
 *
 * Body: {
 *   session_id?: string,   // omit to create new session
 *   message: string,
 *   context?: {             // optional reel-specific context
 *     type: 'reel',
 *     reel_id: string,
 *     reel_data: string,
 *     gemini_analysis: string | null,
 *   },
 * }
 *
 * SSE events:
 *   { type: 'session',    session_id }
 *   { type: 'status',     label }           — "Pensando...", "Analizando reels..."
 *   { type: 'tool_start', tool }            — tool name starting
 *   { type: 'tool_done',  tool }            — tool name finished
 *   { type: 'done',       message, tokens_used }
 *   { type: 'error',      message }
 */

// Extend timeout to 120s — tool loop + specialist sub-agents can take 60-90s
export const maxDuration = 120;

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { callLLM, type LLMMessage, type LLMOptions, type LLMResponse } from '@/services/llm.service';
import { getLLMConfig } from '@/services/llm-config';
import { logLLMUsage } from '@/services/llm-usage.service';
import { ARKO_TOOLS, executeArkoTool, loadWorkspaceSnapshot, classifyMessageComplexity } from '@/services/arko-ai-context';
import { buildArkoSystemPrompt, buildReelContextPrompt, buildScriptContextPrompt, type PromptLocale } from '@/services/arko-ai-prompts';
import { getUserLanguage } from '@/i18n/server';

const MAX_TOOL_ITERATIONS = 5;

/** Max tokens allowed for chat history to avoid context-length errors.
 *  Claude Sonnet supports 200K input; we reserve headroom for system prompt,
 *  tools definitions, workspace snapshot, reel context, and tool results. */
const MAX_HISTORY_TOKENS = 80_000;

/** Rough token estimator: ~4 chars per token (heuristic, good enough for truncation). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Keep most recent messages whose combined tokens fit within the budget.
 *  Always preserves the last user message (the one being answered). */
function truncateHistoryByTokens(
  messages: LLMMessage[],
  maxTokens: number,
): { messages: LLMMessage[]; truncated: boolean; droppedCount: number } {
  if (messages.length === 0) return { messages, truncated: false, droppedCount: 0 };

  let total = 0;
  const kept: LLMMessage[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(messages[i].content);
    if (total + tokens > maxTokens && kept.length > 0) break;
    total += tokens;
    kept.unshift(messages[i]);
  }

  return {
    messages: kept,
    truncated: kept.length < messages.length,
    droppedCount: messages.length - kept.length,
  };
}

/** Detects if an error is recoverable by shrinking the prompt/retry. */
function isRecoverableLLMError(err: unknown): 'shrink' | 'retry' | null {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes('context') && (msg.includes('length') || msg.includes('window') || msg.includes('too long'))) return 'shrink';
  if (msg.includes('prompt is too long') || msg.includes('max_tokens')) return 'shrink';
  if (msg.includes('rate') && msg.includes('limit')) return 'retry';
  if (msg.includes('overloaded') || msg.includes('503') || msg.includes('529')) return 'retry';
  if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('econnreset')) return 'retry';
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Calls Claude with resilience: on context-overflow errors, shrinks history and retries;
 *  on transient errors (rate limit, overload, timeout), backs off and retries.
 *  Mutates `messages` in place when shrinking so the caller sees the final set. */
async function callLLMWithResilience(
  options: LLMOptions,
  onShrink?: (keptCount: number, droppedCount: number) => void,
): Promise<LLMResponse> {
  const budgets = [MAX_HISTORY_TOKENS, 50_000, 25_000, 10_000, 4_000];
  let attempt = 0;
  let lastErr: unknown;

  while (attempt < budgets.length + 2) {
    try {
      return await callLLM(options);
    } catch (err) {
      lastErr = err;
      const kind = isRecoverableLLMError(err);
      if (!kind) throw err;

      if (kind === 'shrink') {
        const nextBudget = budgets[Math.min(attempt, budgets.length - 1)];
        const before = options.messages.length;
        const { messages: shrunk, droppedCount } = truncateHistoryByTokens(options.messages, nextBudget);
        if (droppedCount === 0 && attempt > 0) {
          // Can't shrink further — give up
          throw err;
        }
        options.messages = shrunk;
        if (onShrink && droppedCount > 0) onShrink(shrunk.length, before - shrunk.length);
        console.warn(`[chat] Shrinking history (attempt ${attempt + 1}): kept ${shrunk.length}, dropped ${before - shrunk.length}, budget ${nextBudget}`);
      } else {
        // Transient error — exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        console.warn(`[chat] Transient error (attempt ${attempt + 1}), retrying in ${delay}ms:`, (err as Error).message);
        await sleep(delay);
      }
      attempt++;
    }
  }

  throw lastErr;
}

/** Human-readable labels for each tool, per locale. */
const TOOL_LABELS: Record<PromptLocale, Record<string, string>> = {
  es: {
    query_reels: 'Analizando reels',
    get_reel_details: 'Cargando detalle del reel',
    get_account_insights: 'Consultando métricas de cuenta',
    get_content_calendar: 'Analizando frecuencia de publicación',
    get_audience_demographics: 'Cargando datos demográficos',
    compare_periods: 'Comparando períodos',
    get_benchmarks: 'Consultando benchmarks',
    get_goals: 'Revisando metas',
    search_reels_by_topic: 'Buscando por tema',
    get_top_hooks: 'Analizando mejores hooks',
    get_topic_clusters: 'Mapeando clusters de temas',
    get_competitor_analysis: 'Analizando competencia',
    consult_specialist: 'Consultando especialista',
    list_pipeline_items: 'Revisando pipeline de contenido',
    add_content_to_pipeline: 'Agregando al pipeline',
    update_content_item: 'Actualizando item',
    get_content_item: 'Cargando detalle del item',
    delete_content_item: 'Eliminando item',
  },
  en: {
    query_reels: 'Analyzing reels',
    get_reel_details: 'Loading reel details',
    get_account_insights: 'Querying account metrics',
    get_content_calendar: 'Analyzing posting cadence',
    get_audience_demographics: 'Loading demographics',
    compare_periods: 'Comparing periods',
    get_benchmarks: 'Querying benchmarks',
    get_goals: 'Reviewing goals',
    search_reels_by_topic: 'Searching by topic',
    get_top_hooks: 'Analyzing top hooks',
    get_topic_clusters: 'Mapping topic clusters',
    get_competitor_analysis: 'Analyzing competitors',
    consult_specialist: 'Consulting specialist',
    list_pipeline_items: 'Reviewing content pipeline',
    add_content_to_pipeline: 'Adding to pipeline',
    update_content_item: 'Updating item',
    get_content_item: 'Loading item details',
    delete_content_item: 'Deleting item',
  },
};

const STATUS_LABELS: Record<PromptLocale, { thinking: string; analyzing: string; processing: string; generating: string; synthesizing: string }> = {
  es: {
    thinking: 'Pensando...',
    analyzing: 'Analizando tu pregunta...',
    processing: 'Procesando datos...',
    generating: 'Generando respuesta...',
    synthesizing: 'Sintetizando respuesta...',
  },
  en: {
    thinking: 'Thinking...',
    analyzing: 'Analyzing your question...',
    processing: 'Processing data...',
    generating: 'Generating response...',
    synthesizing: 'Synthesizing response...',
  },
};

const ERROR_MESSAGES: Record<PromptLocale, {
  fallback: string;
  tooManyTools: string;
  generic: string;
  contextTooLong: string;
  rateLimit: string;
  overloaded: string;
  billing: string;
}> = {
  es: {
    fallback: 'Disculpá, no pude generar una respuesta. ¿Podés intentar de nuevo?',
    tooManyTools: 'Disculpá, necesité demasiadas consultas para responder. ¿Podés reformular tu pregunta?',
    generic: 'Hubo un error al procesar tu mensaje. ¿Podés intentar de nuevo?',
    contextTooLong: 'La conversación es demasiado larga. Por favor iniciá una nueva sesión para continuar.',
    rateLimit: 'Estamos procesando muchas consultas. Esperá unos segundos y volvé a intentar.',
    overloaded: 'El servicio de IA está sobrecargado. Intentá de nuevo en un momento.',
    billing: 'Hay un problema de configuración del servicio. Contactá soporte.',
  },
  en: {
    fallback: "Sorry, I couldn't generate a response. Can you try again?",
    tooManyTools: 'Sorry, I needed too many queries to answer. Can you rephrase your question?',
    generic: 'Something went wrong processing your message. Can you try again?',
    contextTooLong: 'The conversation is too long. Please start a new session to continue.',
    rateLimit: "We're processing many queries. Wait a few seconds and try again.",
    overloaded: 'The AI service is overloaded. Try again in a moment.',
    billing: "There's a service configuration issue. Please contact support.",
  },
};

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  // Helper to send an SSE event
  function sseEvent(data: Record<string, unknown>): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      // Hoisted so the catch block can localize error messages.
      let userLocale: PromptLocale = 'es';
      try {
        const auth = await authenticateRequest(request);
        if (isAuthError(auth)) {
          controller.enqueue(sseEvent({ type: 'error', message: 'No autorizado' }));
          controller.close();
          return;
        }

        const body = await request.json();
        const { session_id, message, context } = body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
          controller.enqueue(sseEvent({ type: 'error', message: 'message is required' }));
          controller.close();
          return;
        }

        // Validate context shape if provided
        const reelContext = context?.type === 'reel' && typeof context.reel_id === 'string' && typeof context.reel_data === 'string'
          ? context as { type: 'reel'; reel_id: string; reel_data: string; gemini_analysis: string | null }
          : null;

        // Script context — sent on every message while the user is in the
        // script editor. Stateless (not persisted on the session) since the
        // script content itself is the source of truth in `content_plan`.
        const scriptContext = context?.type === 'script' && typeof context.script_id === 'string'
          ? context as {
              type: 'script';
              script_id: string;
              title: string | null;
              content_type: string | null;
              status: string | null;
              planned_date: string | null;
              script: string | null;
            }
          : null;

        const supabase = await createClient();
        let sessionId = session_id;
        let isReelSession = false;
        let reelContextData: string | null = null;
        let reelGeminiData: string | null = null;

        // Create session if not provided
        if (!sessionId) {
          const insertPayload: Record<string, unknown> = {
            workspace_id: auth.workspaceId,
            user_id: auth.userId,
            title: message.trim().substring(0, 80),
          };

          // Attach reel context to session
          if (reelContext) {
            insertPayload.context_reel_ids = [reelContext.reel_id];
            isReelSession = true;
            reelContextData = reelContext.reel_data;
            reelGeminiData = reelContext.gemini_analysis;
          }

          const { data: session, error: sessError } = await supabase
            .from('chat_sessions')
            .insert(insertPayload)
            .select('id')
            .single();

          if (sessError) {
            console.error('[chat] Create session error:', sessError);
            controller.enqueue(sseEvent({ type: 'error', message: 'Error al crear sesión' }));
            controller.close();
            return;
          }
          sessionId = session.id;
        } else {
          // Check if existing session has reel context
          const { data: existingSession } = await supabase
            .from('chat_sessions')
            .select('context_reel_ids')
            .eq('id', sessionId)
            .single();

          if (existingSession?.context_reel_ids?.length > 0) {
            isReelSession = true;
            // For existing reel sessions, the reel data was sent on first message.
            // On subsequent messages, if context is provided, use it; otherwise
            // the system prompt will still include the reel context block from the first message context.
            if (reelContext) {
              reelContextData = reelContext.reel_data;
              reelGeminiData = reelContext.gemini_analysis;
            }
          }
        }

        // Send session_id immediately so client can track it
        controller.enqueue(sseEvent({ type: 'session', session_id: sessionId }));

        // Save user message
        const { error: userMsgError } = await supabase.from('chat_messages').insert({
          session_id: sessionId,
          workspace_id: auth.workspaceId,
          role: 'user',
          content: message.trim(),
        });
        if (userMsgError) {
          console.error('[chat] Save user message error:', userMsgError);
        }

        // Send initial thinking status — locale resolved a few lines below.

        // Load chat history (last 30 messages — will be token-truncated below)
        const { data: history } = await supabase
          .from('chat_messages')
          .select('role, content')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true })
          .limit(30);

        // Load workspace snapshot (ADN + benchmarks + top topics — cached 30min)
        const snapshot = await loadWorkspaceSnapshot(supabase, auth.workspaceId);
        // Forward-only language: each new generation uses the language stored
        // on the user that triggered this turn (profiles.language).
        userLocale = (await getUserLanguage(auth.userId)) as PromptLocale;
        const status = STATUS_LABELS[userLocale];
        const tools = TOOL_LABELS[userLocale];
        controller.enqueue(sseEvent({ type: 'status', label: status.thinking }));
        let systemPrompt = buildArkoSystemPrompt(snapshot.adnContext, snapshot.benchmarksContext, snapshot.topTopicsContext, userLocale);

        // Append reel-specific context if this is a reel session
        if (isReelSession && reelContextData) {
          systemPrompt += buildReelContextPrompt(reelContextData, reelGeminiData);
        }

        // Append script-editing context (stateless — comes from the client on
        // every message while the user is editing a specific script).
        if (scriptContext) {
          systemPrompt += buildScriptContextPrompt({
            script_id: scriptContext.script_id,
            title: scriptContext.title,
            content_type: scriptContext.content_type,
            status: scriptContext.status,
            planned_date: scriptContext.planned_date,
            script: scriptContext.script,
          });
        }

        // Build LLM messages from history
        const rawMessages: LLMMessage[] = (history ?? [])
          .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
          .map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));

        // Truncate by tokens to avoid context-length errors on long sessions
        const { messages: llmMessages, truncated, droppedCount } = truncateHistoryByTokens(
          rawMessages,
          MAX_HISTORY_TOKENS,
        );
        if (truncated) {
          console.log(`[chat] Truncated history: dropped ${droppedCount} oldest messages (session_id=${sessionId})`);
        }

        // ─── Route by message complexity ──────────────────────────────────────────
        const recentTexts = llmMessages.filter(m => m.role === 'user').map(m => m.content);
        // Reel and script sessions always use the complex path (Claude Sonnet + tools)
        const complexity = (isReelSession || scriptContext) ? 'complex' : classifyMessageComplexity(message, recentTexts);

        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalLatency = 0;
        const currentMessages = [...llmMessages];
        let assistantContent = '';
        const toolsUsed: { name: string; input_keys: string[] }[] = [];
        const specialistsUsed: { domain: string; tokensUsed: number; latencyMs: number }[] = [];
        let lastModel = '';
        let featureUsed: 'ai-agents' | 'ai-agents-light' = 'ai-agents';

        if (complexity === 'simple') {
          // ─── Simple path: GPT-4.1-mini, no tools ────────────────────────────
          const lightConfig = getLLMConfig('ai-agents-light');
          featureUsed = 'ai-agents-light';

          controller.enqueue(sseEvent({ type: 'status', label: status.generating }));

          const llmStart = Date.now();
          const lightOptions: LLMOptions = {
            provider: lightConfig.provider,
            model: lightConfig.model,
            messages: currentMessages,
            system: systemPrompt,
            maxTokens: lightConfig.maxTokens,
          };
          const response = await callLLMWithResilience(lightOptions);
          const llmLatency = Date.now() - llmStart;

          totalInputTokens = response.inputTokens;
          totalOutputTokens = response.outputTokens;
          totalLatency = llmLatency;
          lastModel = response.model;
          assistantContent = response.text || ERROR_MESSAGES[userLocale].fallback;

          logLLMUsage(supabase, {
            workspaceId: auth.workspaceId,
            userId: auth.userId,
            feature: 'ai-agents-light',
            response,
            latencyMs: llmLatency,
          }).catch(() => {});
        } else {
          // ─── Complex path: Claude Sonnet with full tool loop ─────────────────
          const config = getLLMConfig('ai-agents');

          for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
            controller.enqueue(sseEvent({
              type: 'status',
              label: i === 0 ? status.analyzing : status.processing,
            }));

            const llmStart = Date.now();
            const loopOptions: LLMOptions = {
              provider: config.provider,
              model: config.model,
              messages: currentMessages,
              system: systemPrompt,
              tools: ARKO_TOOLS,
              maxTokens: config.maxTokens,
            };
            const response = await callLLMWithResilience(loopOptions);
            const llmLatency = Date.now() - llmStart;

            totalInputTokens += response.inputTokens;
            totalOutputTokens += response.outputTokens;
            totalLatency += llmLatency;
            lastModel = response.model;

            logLLMUsage(supabase, {
              workspaceId: auth.workspaceId,
              userId: auth.userId,
              feature: 'ai-agents',
              response,
              latencyMs: llmLatency,
            }).catch(() => {});

            // If Claude returned text and no tool calls → done
            if (response.toolCalls.length === 0) {
              assistantContent = response.text || ERROR_MESSAGES[userLocale].fallback;
              break;
            }

            // Execute tools — stream progress for each one
            const toolCalls = response.toolCalls;
            toolCalls.forEach(tc => toolsUsed.push({ name: tc.name, input_keys: Object.keys(tc.input) }));

            // Emit tool_start for all tools being called
            for (const tc of toolCalls) {
              controller.enqueue(sseEvent({
                type: 'tool_start',
                tool: tc.name,
                label: tools[tc.name] || tc.name,
              }));
            }

            const toolResults = await Promise.all(
              toolCalls.map(async (tc) => {
                try {
                  const result = await executeArkoTool(supabase, auth.workspaceId, tc.name, tc.input, snapshot.adnContext, userLocale);
                  controller.enqueue(sseEvent({
                    type: 'tool_done',
                    tool: tc.name,
                    label: tools[tc.name] || tc.name,
                  }));
                  return result;
                } catch (toolErr) {
                  const errMsg = toolErr instanceof Error ? toolErr.message : String(toolErr);
                  console.error(`[chat] Tool "${tc.name}" failed:`, errMsg);
                  controller.enqueue(sseEvent({
                    type: 'tool_done',
                    tool: tc.name,
                    label: tools[tc.name] || tc.name,
                  }));
                  return { result: JSON.stringify({ error: `Tool "${tc.name}" failed: ${errMsg}` }) };
                }
              })
            );

            const toolResultParts: string[] = [];
            for (let t = 0; t < toolCalls.length; t++) {
              toolResultParts.push(`[Tool: ${toolCalls[t].name}]\n${toolResults[t].result}`);
              if (toolResults[t].specialistUsed) {
                const s = toolResults[t].specialistUsed!;
                specialistsUsed.push({ domain: s.domain, tokensUsed: s.tokensUsed, latencyMs: s.latencyMs });
                totalInputTokens += s.tokensUsed;
              }
              if (toolResults[t].contentAdded?.length) {
                controller.enqueue(sseEvent({ type: 'content_added', items: toolResults[t].contentAdded }));
              }
              if (toolResults[t].contentUpdated) {
                controller.enqueue(sseEvent({ type: 'content_updated', item: toolResults[t].contentUpdated }));
              }
              if (toolResults[t].contentDeleted) {
                controller.enqueue(sseEvent({ type: 'content_deleted', id: toolResults[t].contentDeleted!.id }));
              }
            }

            if (response.text) {
              assistantContent = response.text;
            }

            currentMessages.push({
              role: 'assistant',
              content: response.text || `[Consultando: ${response.toolCalls.map(t => t.name).join(', ')}]`,
            });

            currentMessages.push({
              role: 'user',
              content: `[Resultados de herramientas]\n\n${toolResultParts.join('\n\n')}\n\n[Analizá estos datos y respondé al usuario.]`,
            });

            if (i === MAX_TOOL_ITERATIONS - 1 && !assistantContent) {
              assistantContent = ERROR_MESSAGES[userLocale].tooManyTools;
            }

            // Show "synthesizing" status before next iteration or final response
            controller.enqueue(sseEvent({ type: 'status', label: status.synthesizing }));
          }
        }

        // ─── Save response ────────────────────────────────────────────────────

        const totalTokens = totalInputTokens + totalOutputTokens;

        const [assistantMsgResult, sessionUpdateResult] = await Promise.all([
          supabase
            .from('chat_messages')
            .insert({
              session_id: sessionId,
              workspace_id: auth.workspaceId,
              role: 'assistant',
              content: assistantContent,
              grounding_data: {
                complexity,
                feature: featureUsed,
                tools_used: toolsUsed,
                specialists_used: specialistsUsed,
                model: lastModel,
              },
              tokens_used: totalTokens,
            })
            .select('id, role, content, created_at')
            .single(),

          // Update session updated_at
          supabase
            .from('chat_sessions')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', sessionId),
        ]);

        if (assistantMsgResult.error) {
          console.error('[chat] Save assistant message error:', assistantMsgResult.error);
        }
        if (sessionUpdateResult.error) {
          console.error('[chat] Update session error:', sessionUpdateResult.error);
        }

        const assistantMsg = assistantMsgResult.data;

        // Send final response
        controller.enqueue(sseEvent({
          type: 'done',
          session_id: sessionId,
          message: assistantMsg,
          tokens_used: totalTokens,
        }));

        controller.close();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStack = err instanceof Error ? err.stack : undefined;
        console.error('[chat] POST error:', { message: errMsg, stack: errStack, error: err });

        // Map known error patterns to user-friendly messages.
        const errCopy = ERROR_MESSAGES[userLocale];
        let userMessage = process.env.NODE_ENV === 'development'
          ? `[DEV] ${errMsg}`
          : errCopy.generic;
        const lowerErr = errMsg.toLowerCase();
        if (lowerErr.includes('context') && (lowerErr.includes('length') || lowerErr.includes('window') || lowerErr.includes('too long'))) {
          userMessage = errCopy.contextTooLong;
        } else if (lowerErr.includes('rate') && lowerErr.includes('limit')) {
          userMessage = errCopy.rateLimit;
        } else if (lowerErr.includes('overloaded') || lowerErr.includes('503')) {
          userMessage = errCopy.overloaded;
        } else if (lowerErr.includes('credit') || lowerErr.includes('billing') || lowerErr.includes('quota')) {
          userMessage = errCopy.billing;
        }

        controller.enqueue(sseEvent({ type: 'error', message: userMessage }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
