/**
 * POST /api/v1/competitors/[id]/reels/[reelId]/analyze
 * Analyze a single competitor reel with Gemini/Claude.
 * Logs cost to llm_usage.
 */

export const maxDuration = 120;

import { createClient } from '@/lib/supabase/server';
import { isAuthError } from '@/lib/api/auth';
import { requireFeature } from '@/lib/api/guard';
import { apiSuccess, api400, api500 } from '@/lib/api/response';
import { analyzeSingleCompetitorReel } from '@/services/competitor-analysis.service';
import { calculateCost } from '@/services/llm-usage.service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; reelId: string }> }
) {
  try {
    const auth = await requireFeature(request, 'competitors');
    if (isAuthError(auth)) return auth;

    const { id: competitorId, reelId } = await params;
    const supabase = await createClient();

    // Verify competitor belongs to workspace
    const { data: competitor } = await supabase
      .from('workspace_competitors')
      .select('id, name')
      .eq('id', competitorId)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (!competitor) {
      return api400('Competidor no encontrado');
    }

    // Verify reel belongs to this competitor
    const { data: reel } = await supabase
      .from('competitor_reels')
      .select('id')
      .eq('id', reelId)
      .eq('competitor_id', competitorId)
      .maybeSingle();

    if (!reel) {
      return api400('Reel no encontrado');
    }

    const startMs = Date.now();
    const result = await analyzeSingleCompetitorReel(supabase, reelId, auth.workspaceId);
    const latencyMs = Date.now() - startMs;

    // Log cost
    if (result.success && result.tokensUsed > 0) {
      const estimatedInput = Math.round(result.tokensUsed * 0.85);
      const estimatedOutput = result.tokensUsed - estimatedInput;
      const costUsd = calculateCost('gemini-2.5-flash', estimatedInput, estimatedOutput);

      await supabase.from('llm_usage').insert({
        workspace_id: auth.workspaceId,
        user_id: auth.userId,
        feature: 'competitor-analysis',
        provider: 'google',
        model: 'gemini-2.5-flash',
        input_tokens: estimatedInput,
        output_tokens: estimatedOutput,
        total_tokens: result.tokensUsed,
        cost_usd: costUsd,
        latency_ms: latencyMs,
      });
    }

    if (!result.success) {
      return api400(result.error ?? 'Error analizando reel');
    }

    // Fetch the saved analysis to return it directly (avoids client needing to refetch)
    const { data: analysis } = await supabase
      .from('competitor_reel_analysis')
      .select('hook_text, hook_type, narrative_structure, content_type, cta_text, cta_type, topic_cluster, style_notes, strengths, weaknesses, ai_summary, model_used')
      .eq('competitor_reel_id', reelId)
      .maybeSingle();

    return apiSuccess({
      reel_id: reelId,
      tokens_used: result.tokensUsed,
      analysis,
    });
  } catch (error) {
    console.error('[competitors/reels/analyze] Error:', error);
    return api500('Error analizando reel');
  }
}
