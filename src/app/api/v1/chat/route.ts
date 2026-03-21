/**
 * POST /api/v1/chat
 * Analytical chat with grounding — PRD 8.3, 9.1, 9.4
 *
 * Body: {
 *   workspace_id: string,
 *   session_id?: string,   // omit to create new session
 *   message: string,
 *   context_reel_ids?: string[]
 * }
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const { session_id, message, context_reel_ids } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return api400('message is required');
    }

    const supabase = await createClient();
    let sessionId = session_id;

    // Create session if not provided
    if (!sessionId) {
      const { data: session, error: sessError } = await supabase
        .from('chat_sessions')
        .insert({
          workspace_id: auth.workspaceId,
          user_id: auth.userId,
          title: message.substring(0, 80),
          context_reel_ids: context_reel_ids || [],
        })
        .select('id')
        .single();

      if (sessError) {
        console.error('[chat] Create session error:', sessError);
        return api500();
      }
      sessionId = session.id;
    }

    // Save user message
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      workspace_id: auth.workspaceId,
      role: 'user',
      content: message.trim(),
    });

    // ── Grounding: Gather context data (PRD 9.1) ──

    // Get latest benchmark
    const { data: benchmark } = await supabase
      .from('reel_benchmarks')
      .select('*')
      .eq('workspace_id', auth.workspaceId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    // Get recent reels with metrics for context
    const { data: recentReels } = await supabase
      .from('reels')
      .select(`
        id, caption, permalink, published_at, reel_type, has_ads, duration_seconds,
        reel_metrics (views_org, likes_total, comments_total, shares_total, saves_total, follows_generated, avg_watch_time_sec),
        reel_metrics_paid (views_paid, spend_cents),
        reel_narrative_analysis (core_promise, topic_cluster, has_cta, cta_type, language_specificity, hook_text)
      `)
      .eq('workspace_id', auth.workspaceId)
      .order('published_at', { ascending: false })
      .limit(20);

    // Build grounding context
    const groundingData = {
      benchmark: benchmark || null,
      reels_count: recentReels?.length || 0,
      reels_summary: (recentReels || []).map(r => ({
        id: r.id,
        caption_preview: r.caption?.substring(0, 100) || '',
        published_at: r.published_at,
        reel_type: r.reel_type,
        has_ads: r.has_ads,
      })),
    };

    // TODO: Call OpenAI with grounded system prompt + context
    // For now, return a placeholder response indicating the system is ready
    const assistantContent = `[Sistema en desarrollo] Tu mensaje fue recibido. El chat analítico con grounding está preparado para procesar consultas basadas en ${recentReels?.length || 0} Reels disponibles. La implementación del LLM con contexto real se activará en la siguiente fase.`;

    // Save assistant message
    const { data: assistantMsg } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        workspace_id: auth.workspaceId,
        role: 'assistant',
        content: assistantContent,
        grounding_data: groundingData,
      })
      .select('id, role, content, created_at')
      .single();

    // Audit log
    await supabase.from('audit_logs').insert({
      workspace_id: auth.workspaceId,
      user_id: auth.userId,
      action_type: 'chat_response',
      entity_type: 'chat_session',
      entity_id: sessionId,
      request_summary: message.substring(0, 200),
      response_summary: assistantContent.substring(0, 200),
      evidence_used: groundingData,
    });

    return apiSuccess({
      session_id: sessionId,
      message: assistantMsg,
    });
  } catch {
    return api500();
  }
}
