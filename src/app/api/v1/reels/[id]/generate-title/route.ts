/**
 * POST /api/v1/reels/[id]/generate-title
 * Genera un título automático (≤60 chars) para el reel.
 * Usa la transcripción si está disponible, sino el caption.
 * Guarda el resultado en reels.auto_title.
 */

export const maxDuration = 120; // trabajo pesado (LLM/Gemini/Apify): headroom anti-timeout

import { createClient } from '@/lib/supabase/server';
import { isAuthError } from '@/lib/api/auth';
import { requireFeature } from '@/lib/api/guard';
import { apiSuccess, api400, api404, api500 } from '@/lib/api/response';
import { callLLM } from '@/services/llm.service';
import { getLLMConfig } from '@/services/llm-config';
import { logLLMUsage } from '@/services/llm-usage.service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireFeature(request, 'reelAiAnalysis');
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const supabase = await createClient();

    // Obtener reel con caption
    const { data: reel, error: reelError } = await supabase
      .from('reels')
      .select('id, caption, auto_title')
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId)
      .single();

    if (reelError || !reel) {
      return api404('Reel no encontrado');
    }

    // Si ya tiene título, devolverlo sin re-generar
    if (reel.auto_title) {
      return apiSuccess({ auto_title: reel.auto_title });
    }

    // Intentar obtener transcripción (no es obligatoria)
    const { data: transcript } = await supabase
      .from('reel_transcripts')
      .select('transcript_text, processing_status')
      .eq('reel_id', id)
      .maybeSingle();

    const hasTranscript = transcript?.processing_status === 'completed' && !!transcript.transcript_text;
    const inputText = hasTranscript
      ? transcript!.transcript_text!.slice(0, 2000)
      : reel.caption?.slice(0, 500) ?? null;

    if (!inputText) {
      return api400('El reel no tiene transcripción ni caption para generar el título');
    }

    const cfg = getLLMConfig('reel-auto-title');
    const source = hasTranscript ? 'transcripción' : 'caption';

    const response = await callLLM({
      provider: cfg.provider,
      model: cfg.model,
      maxTokens: cfg.maxTokens,
      system: 'Eres un asistente que genera títulos internos para videos de Instagram Reels. El título debe describir el TEMA CENTRAL del video de forma clara y profesional en español. REGLAS: máximo 60 caracteres, sin hashtags, sin emojis, sin CTAs ("comentá", "guardá", "seguime"), sin puntos finales, sin comillas. Responde ÚNICAMENTE con el título.',
      messages: [
        {
          role: 'user',
          content: `Basándote en esta ${source} de un Instagram Reel, generá un título que describa el tema o concepto principal que explica el video. NO copies el texto, NO uses CTAs.\n\n${source === 'transcripción' ? 'Transcripción' : 'Caption'}:\n${inputText}`,
        },
      ],
    });

    // Log de costo (no-bloqueante) — antes faltaba y dejaba ciego el tracking de LLM.
    logLLMUsage(supabase, {
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      feature: 'reel-auto-title',
      response,
    }).catch(() => {});

    const rawTitle = response.text.trim().replace(/^["']|["']$/g, '').replace(/\.$/, '').replace(/#\w+/g, '').trim();
    const auto_title = rawTitle.slice(0, 60).trim();

    const { error: updateError } = await supabase
      .from('reels')
      .update({ auto_title })
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId);

    if (updateError) {
      console.error('[generate-title] Update error:', updateError);
      return api500();
    }

    return apiSuccess({ auto_title });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[generate-title]', message);
    return api500(message);
  }
}
