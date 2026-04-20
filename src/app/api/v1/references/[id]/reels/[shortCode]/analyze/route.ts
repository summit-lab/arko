/**
 * POST /api/v1/references/[id]/reels/[shortCode]/analyze
 *
 * Analyze a single reference reel (identified by its IG short_code within the
 * parent reference's scraped_reels jsonb array). Text-only Gemini analysis
 * since references don't store video URLs.
 *
 * Logs cost to llm_usage with feature 'reference-analysis'.
 */

export const maxDuration = 60;

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';
import { analyzeSingleReferenceReel } from '@/services/reference-analysis.service';
import { calculateCost } from '@/services/llm-usage.service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; shortCode: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { id: referenceId, shortCode } = await params;
    if (!shortCode) return api400('shortCode requerido');

    const supabase = await createClient();

    const { data: reference } = await supabase
      .from('workspace_references')
      .select('id, brand_name')
      .eq('id', referenceId)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (!reference) return api400('Referencia no encontrada');

    const startMs = Date.now();
    const result = await analyzeSingleReferenceReel(supabase, referenceId, shortCode, auth.workspaceId);
    const latencyMs = Date.now() - startMs;

    if (result.success && result.tokensUsed > 0) {
      const estimatedInput = Math.round(result.tokensUsed * 0.85);
      const estimatedOutput = result.tokensUsed - estimatedInput;
      const costUsd = calculateCost('gemini-2.5-flash', estimatedInput, estimatedOutput);

      await supabase.from('llm_usage').insert({
        workspace_id: auth.workspaceId,
        user_id: auth.userId,
        feature: 'reference-analysis',
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

    const { data: analysis } = await supabase
      .from('reference_reel_analysis')
      .select('*')
      .eq('reference_id', referenceId)
      .eq('reel_short_code', shortCode)
      .maybeSingle();

    return apiSuccess({ analysis });
  } catch (error) {
    console.error('[references/.../analyze] Error:', error);
    return api500('Error analizando reel');
  }
}
