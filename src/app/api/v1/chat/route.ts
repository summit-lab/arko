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
import { callLLM, type LLMMessage } from '@/services/llm.service';
import { getLLMConfig } from '@/services/llm-config';
import { logLLMUsage } from '@/services/llm-usage.service';
import { ARKO_TOOLS, executeArkoTool, loadWorkspaceSnapshot, classifyMessageComplexity } from '@/services/arko-ai-context';
import { buildArkoSystemPrompt, buildReelContextPrompt } from '@/services/arko-ai-prompts';

const MAX_TOOL_ITERATIONS = 5;

/** Human-readable labels for each tool */
const TOOL_LABELS: Record<string, string> = {
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
};

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  // Helper to send an SSE event
  function sseEvent(data: Record<string, unknown>): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // DEBUG: verificar si las env vars llegan al runtime
        console.log('[chat] ENV CHECK — OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY, '| length:', process.env.OPENAI_API_KEY?.length ?? 0);

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
        await supabase.from('chat_messages').insert({
          session_id: sessionId,
          workspace_id: auth.workspaceId,
          role: 'user',
          content: message.trim(),
        });

        // Send initial thinking status
        controller.enqueue(sseEvent({ type: 'status', label: 'Pensando...' }));

        // Load chat history (last 20 messages)
        const { data: history } = await supabase
          .from('chat_messages')
          .select('role, content')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true })
          .limit(20);

        // Load workspace snapshot (ADN + benchmarks + top topics — cached 30min)
        const snapshot = await loadWorkspaceSnapshot(supabase, auth.workspaceId);
        let systemPrompt = buildArkoSystemPrompt(snapshot.adnContext, snapshot.benchmarksContext, snapshot.topTopicsContext);

        // Append reel-specific context if this is a reel session
        if (isReelSession && reelContextData) {
          systemPrompt += buildReelContextPrompt(reelContextData, reelGeminiData);
        }

        // Build LLM messages from history
        const llmMessages: LLMMessage[] = (history ?? [])
          .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
          .map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));

        // ─── Route by message complexity ──────────────────────────────────────────
        const recentTexts = llmMessages.filter(m => m.role === 'user').map(m => m.content);
        // Reel sessions always use the complex path (Claude Sonnet + tools)
        const complexity = isReelSession ? 'complex' : classifyMessageComplexity(message, recentTexts);

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

          controller.enqueue(sseEvent({ type: 'status', label: 'Generando respuesta...' }));

          const llmStart = Date.now();
          const response = await callLLM({
            provider: lightConfig.provider,
            model: lightConfig.model,
            messages: currentMessages,
            system: systemPrompt,
            maxTokens: lightConfig.maxTokens,
          });
          const llmLatency = Date.now() - llmStart;

          totalInputTokens = response.inputTokens;
          totalOutputTokens = response.outputTokens;
          totalLatency = llmLatency;
          lastModel = response.model;
          assistantContent = response.text || 'Disculpá, no pude generar una respuesta. ¿Podés intentar de nuevo?';

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
              label: i === 0 ? 'Analizando tu pregunta...' : 'Procesando datos...',
            }));

            const llmStart = Date.now();
            const response = await callLLM({
              provider: config.provider,
              model: config.model,
              messages: currentMessages,
              system: systemPrompt,
              tools: ARKO_TOOLS,
              maxTokens: config.maxTokens,
            });
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
              assistantContent = response.text || 'Disculpá, no pude generar una respuesta. ¿Podés intentar de nuevo?';
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
                label: TOOL_LABELS[tc.name] || tc.name,
              }));
            }

            const toolResults = await Promise.all(
              toolCalls.map(async (tc) => {
                const result = await executeArkoTool(supabase, auth.workspaceId, tc.name, tc.input, snapshot.adnContext);
                // Emit tool_done when each tool finishes
                controller.enqueue(sseEvent({
                  type: 'tool_done',
                  tool: tc.name,
                  label: TOOL_LABELS[tc.name] || tc.name,
                }));
                return result;
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
              assistantContent = 'Disculpá, necesité demasiadas consultas para responder. ¿Podés reformular tu pregunta?';
            }

            // Show "synthesizing" status before next iteration or final response
            controller.enqueue(sseEvent({ type: 'status', label: 'Sintetizando respuesta...' }));
          }
        }

        // ─── Save response ────────────────────────────────────────────────────

        const totalTokens = totalInputTokens + totalOutputTokens;

        const [{ data: assistantMsg }] = await Promise.all([
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

        // Send final response
        controller.enqueue(sseEvent({
          type: 'done',
          session_id: sessionId,
          message: assistantMsg,
          tokens_used: totalTokens,
        }));

        controller.close();
      } catch (err) {
        console.error('[chat] POST error:', err);
        controller.enqueue(sseEvent({ type: 'error', message: 'Error interno del servidor' }));
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
