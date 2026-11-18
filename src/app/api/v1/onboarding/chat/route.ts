/**
 * GET/POST /api/v1/onboarding/chat
 * ADN de Comunicación conversational onboarding.
 *
 * GET: Returns current progress + chat history for resumability.
 * POST: Processes a user message, calls LLM with tool_use for data extraction.
 */

export const maxDuration = 120; // trabajo pesado (LLM/Gemini/Apify): headroom anti-timeout

import { createClient } from '@/lib/supabase/server';
import { isAuthError } from '@/lib/api/auth';
import { requireFeature } from '@/lib/api/guard';
import { apiSuccess, api400, api500 } from '@/lib/api/response';
import { callLLM, type LLMMessage } from '@/services/llm.service';
import { getLLMConfig } from '@/services/llm-config';
import { getAdnProgress, getAdnData, getOrCreateAdnSession, markOnboardingComplete } from '@/services/adn-progress.service';
import { buildAdnSystemPrompt, ADN_TOOLS, getAdnWelcomeMessage } from '@/services/adn-prompts';
import { logLLMUsage } from '@/services/llm-usage.service';
import { invalidateWorkspaceCache } from '@/services/arko-ai-context';
import { getUserLanguage } from '@/i18n/server';
import type { PromptLocale } from '@/services/arko-ai-prompts';
import { cfg, type Tier } from '@/lib/tier/config';
import { isUnlimitedWorkspace } from '@/lib/api/credit-guard';
import { normalizeIgUsername } from '@/lib/instagram-username';

// ─── Tool execution: save extracted data to DB ───────────────────────────────

type ServerSupabase = ReturnType<typeof createClient> extends Promise<infer T> ? T : never;

/**
 * save_competitor desde el chat. Antes era un INSERT ciego: cada vez que Moka
 * "actualizaba" un competidor (modo post-ADN) se creaba un DUPLICADO, y además
 * se salteaba el tope del plan (standard 3 / pro 5) que sí aplica el modal.
 * Ahora: si ya existe (mismo username de IG, o mismo nombre sin IG) se
 * actualiza esa fila; si es nuevo, se respeta el tope del plan.
 * Devuelve un aviso para el usuario si no se pudo guardar, o null.
 */
async function saveCompetitorFromChat(
  supabase: ServerSupabase,
  workspaceId: string,
  tier: Tier,
  data: Record<string, unknown>,
): Promise<string | null> {
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
  const name = str(data.name);
  const igUrl = str(data.ig_url);
  const likesBrand = str(data.likes_brand);
  const likesContent = str(data.likes_content);
  const parts: string[] = [];
  if (likesBrand) parts.push(`[MARCA] ${likesBrand}`);
  if (likesContent) parts.push(`[CONTENIDO] ${likesContent}`);
  const whyBetter = parts.length > 0 ? parts.join('\n') : null;

  const { data: existingRows } = await supabase
    .from('workspace_competitors')
    .select('id, name, ig_url')
    .eq('workspace_id', workspaceId);
  const existing = existingRows ?? [];

  const username = normalizeIgUsername(igUrl);
  const match = existing.find((c) => {
    const theirs = normalizeIgUsername(c.ig_url as string | null);
    if (username && theirs) return theirs === username;
    return Boolean(name) && str(c.name).toLowerCase() === name.toLowerCase();
  });

  if (match) {
    const patch: Record<string, string> = {};
    if (name) patch.name = name;
    if (igUrl && !normalizeIgUsername(match.ig_url as string | null)) patch.ig_url = igUrl;
    if (whyBetter) patch.why_better = whyBetter;
    if (Object.keys(patch).length > 0) {
      await supabase
        .from('workspace_competitors')
        .update(patch)
        .eq('id', match.id as string)
        .eq('workspace_id', workspaceId);
    }
    return null;
  }

  if (!name) return null;

  const cap = cfg(tier).maxCompetitors;
  if (existing.length >= cap && !(await isUnlimitedWorkspace(supabase, workspaceId))) {
    return `Tu plan permite seguir hasta ${cap} competidores, así que no agregué a ${name}. Si querés sumarlo, eliminá uno desde la pestaña Competencia.`;
  }

  await supabase
    .from('workspace_competitors')
    .insert({ workspace_id: workspaceId, name, ig_url: igUrl || null, why_better: whyBetter });
  return null;
}

async function executeToolCall(
  supabase: ServerSupabase,
  workspaceId: string,
  tier: Tier,
  toolName: string,
  input: Record<string, unknown>
): Promise<string | null> {
  // Filter out empty/null values
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== null && value !== undefined && value !== '') {
      data[key] = value;
    }
  }

  if (Object.keys(data).length === 0) return null;

  switch (toolName) {
    case 'save_profile':
      await supabase
        .from('workspace_profile')
        .upsert(
          { workspace_id: workspaceId, ...data },
          { onConflict: 'workspace_id' }
        );
      break;

    case 'save_strategy': {
      const platform = data.platform as string;
      delete data.platform;
      await supabase
        .from('workspace_strategies')
        .upsert(
          { workspace_id: workspaceId, platform, ...data },
          { onConflict: 'workspace_id,platform' }
        );
      break;
    }

    case 'save_market':
      await supabase
        .from('workspace_market')
        .upsert(
          { workspace_id: workspaceId, ...data },
          { onConflict: 'workspace_id' }
        );
      break;

    case 'save_competitor':
      return saveCompetitorFromChat(supabase, workspaceId, tier, data);

    case 'save_brand':
      await supabase
        .from('workspace_brand')
        .upsert(
          { workspace_id: workspaceId, ...data },
          { onConflict: 'workspace_id' }
        );
      break;

    case 'save_reference':
      await supabase
        .from('workspace_references')
        .insert({ workspace_id: workspaceId, ...data });
      break;
  }
  return null;
}

// ─── GET: Load state + history ───────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const auth = await requireFeature(request, 'mokaAI');
    if (isAuthError(auth)) return auth;

    const supabase = await createClient();

    const [progress, sessionId, locale] = await Promise.all([
      getAdnProgress(supabase, auth.workspaceId),
      getOrCreateAdnSession(supabase, auth.workspaceId, auth.userId),
      getUserLanguage(auth.userId) as Promise<PromptLocale>,
    ]);

    // Load chat messages
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    return apiSuccess({
      progress,
      session_id: sessionId,
      messages: messages ?? [],
      welcome_message: getAdnWelcomeMessage(locale),
    });
  } catch (err) {
    console.error('[onboarding/chat] GET error:', err);
    return api500();
  }
}

// ─── POST: Process user message ──────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const auth = await requireFeature(request, 'mokaAI');
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return api400('message is required');
    }

    const supabase = await createClient();

    // Get or create session
    const sessionId = await getOrCreateAdnSession(supabase, auth.workspaceId, auth.userId);

    // Save user message
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      workspace_id: auth.workspaceId,
      role: 'user',
      content: message.trim(),
    });

    // Load full chat history for context
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    // Get current ADN progress + already-captured values, so the model can SEE
    // what's already answered (incl. fields filled manually in the editor) and
    // never re-asks them.
    const [progress, adnData] = await Promise.all([
      getAdnProgress(supabase, auth.workspaceId),
      getAdnData(supabase, auth.workspaceId),
    ]);

    // Build messages for LLM (convert DB history to LLM format)
    const llmMessages: LLMMessage[] = (history ?? [])
      .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
      .map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Build system prompt with current progress + user locale
    const userLocale = (await getUserLanguage(auth.userId)) as PromptLocale;
    const systemPrompt = buildAdnSystemPrompt(progress, userLocale, adnData);

    // Call LLM with feature config
    const config = getLLMConfig('onboarding-adn');
    const llmStart = Date.now();
    const response = await callLLM({
      provider: config.provider,
      model: config.model,
      messages: llmMessages,
      system: systemPrompt,
      tools: ADN_TOOLS,
      maxTokens: config.maxTokens,
    });
    const llmLatency = Date.now() - llmStart;

    // Log LLM usage (non-blocking)
    logLLMUsage(supabase, {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      feature: 'onboarding-adn',
      response,
      latencyMs: llmLatency,
    }).catch(() => {});

    // Execute any tool calls (save extracted data). Los avisos (ej. tope de
    // competidores del plan) se agregan a la respuesta para que el usuario
    // sepa que algo NO se guardó — el LLM no se entera de esto.
    const toolNotices: string[] = [];
    for (const toolCall of response.toolCalls) {
      const notice = await executeToolCall(
        supabase,
        auth.workspaceId,
        auth.tier,
        toolCall.name,
        toolCall.input
      );
      if (notice) toolNotices.push(notice);
    }

    // If any ADN data was saved, invalidate Arko AI cache
    if (response.toolCalls.length > 0) {
      invalidateWorkspaceCache(auth.workspaceId);
    }

    // If LLM returned tool calls but no text (common with OpenAI function calling),
    // make a follow-up call with full context so it generates a quality conversational response
    let assistantContent = response.text;

    if (!assistantContent && response.toolCalls.length > 0) {
      const followUpMessages: LLMMessage[] = [
        ...llmMessages,
        {
          role: 'assistant' as const,
          content: `[Datos guardados correctamente: ${response.toolCalls.map(t => t.name).join(', ')}]${toolNotices.length > 0 ? ` [NO guardado: ${toolNotices.join(' ')}]` : ''}`,
        },
        {
          role: 'user' as const,
          content: '[Sistema: Los datos fueron guardados. Ahora respondé al usuario con un mensaje conversacional, hacé un comentario sobre lo que guardaste y preguntá lo siguiente.]',
        },
      ];

      const followUpStart = Date.now();
      const followUp = await callLLM({
        provider: config.provider,
        model: config.model,
        messages: followUpMessages,
        system: systemPrompt,
        maxTokens: config.maxTokens,
      });

      // Log follow-up usage (non-blocking)
      logLLMUsage(supabase, {
        workspaceId: auth.workspaceId,
        userId: auth.userId,
        feature: 'onboarding-adn',
        response: followUp,
        latencyMs: Date.now() - followUpStart,
      }).catch(() => {});

      assistantContent = followUp.text || 'Perfecto, lo guardé. ¿Seguimos?';
    }

    assistantContent = assistantContent || '...';
    if (toolNotices.length > 0) {
      assistantContent += `\n\n> ⚠️ ${toolNotices.join('\n> ⚠️ ')}`;
    }

    // Save assistant message
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      workspace_id: auth.workspaceId,
      role: 'assistant',
      content: assistantContent,
      grounding_data: {
        tools_called: response.toolCalls.map((t) => ({
          name: t.name,
          fields: Object.keys(t.input),
        })),
      },
      tokens_used: response.totalTokens,
    });

    // Update session token count
    await supabase
      .from('chat_sessions')
      .update({
        total_tokens_used: (response.totalTokens),
      })
      .eq('id', sessionId);

    // Re-check progress after saving new data
    const updatedProgress = await getAdnProgress(supabase, auth.workspaceId);

    // If ADN is now complete, mark it
    if (updatedProgress.overall_complete) {
      await markOnboardingComplete(supabase, auth.workspaceId);
    }

    return apiSuccess({
      session_id: sessionId,
      message: assistantContent,
      progress: updatedProgress,
      is_complete: updatedProgress.overall_complete,
      tokens_used: response.totalTokens,
    });
  } catch (err) {
    console.error('[onboarding/chat] POST error:', err);
    return api500();
  }
}
