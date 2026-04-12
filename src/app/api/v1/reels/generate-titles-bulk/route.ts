/**
 * POST /api/v1/reels/generate-titles-bulk
 * Genera auto_title para todos los reels del workspace sin título.
 * Usa transcripción si existe, caption como fallback.
 * Procesa en lotes de 5.
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api500 } from '@/lib/api/response';
import { callLLM } from '@/services/llm.service';
import { getLLMConfig } from '@/services/llm-config';

const BATCH_SIZE = 5;

async function generateTitle(inputText: string, source: 'transcripción' | 'caption'): Promise<string> {
  const cfg = getLLMConfig('reel-auto-title');
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
  const raw = response.text.trim().replace(/^["']|["']$/g, '').replace(/\.$/, '').replace(/#\w+/g, '').trim();
  return raw.slice(0, 60).trim();
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const supabase = await createClient();

    // Todos los reels sin auto_title que tienen al menos caption
    const { data: reels, error } = await supabase
      .from('reels')
      .select('id, caption')
      .eq('workspace_id', auth.workspaceId)
      .is('auto_title', null)
      .not('caption', 'is', null);

    if (error) return api500();
    if (!reels || reels.length === 0) {
      return apiSuccess({ generated: 0, message: 'Todos los reels ya tienen título' });
    }

    // Obtener transcripciones completadas disponibles
    const reelIds = reels.map((r) => r.id);
    const { data: transcripts } = await supabase
      .from('reel_transcripts')
      .select('reel_id, transcript_text')
      .in('reel_id', reelIds)
      .eq('processing_status', 'completed')
      .not('transcript_text', 'is', null);

    const transcriptMap = new Map(
      (transcripts ?? []).map((t) => [t.reel_id, t.transcript_text as string])
    );

    let generated = 0;

    // Procesar en lotes
    for (let i = 0; i < reels.length; i += BATCH_SIZE) {
      const batch = reels.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (r) => {
          try {
            const transcript = transcriptMap.get(r.id);
            const source = transcript ? 'transcripción' : 'caption';
            const inputText = transcript
              ? transcript.slice(0, 2000)
              : (r.caption as string).slice(0, 500);

            const auto_title = await generateTitle(inputText, source);
            await supabase
              .from('reels')
              .update({ auto_title })
              .eq('id', r.id)
              .eq('workspace_id', auth.workspaceId);
            generated++;
          } catch {
            // No cortar el batch por un reel fallido
          }
        })
      );
    }

    return apiSuccess({ generated, total: reels.length });
  } catch {
    return api500();
  }
}
