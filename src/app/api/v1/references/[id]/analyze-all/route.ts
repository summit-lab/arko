/**
 * POST /api/v1/references/[id]/analyze-all
 *
 * Analyze the top-N (default 5) unanalyzed reels of a reference in one batch.
 * Text-only Gemini analysis — each reel is processed sequentially to keep total
 * cost / latency bounded. Already-analyzed reels are skipped.
 *
 * Logs each analysis cost to llm_usage with feature 'reference-analysis'.
 */

export const maxDuration = 120;

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';
import { analyzeReferenceReels } from '@/services/reference-analysis.service';
import { calculateCost } from '@/services/llm-usage.service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { id: referenceId } = await params;
    const supabase = await createClient();

    const { data: reference } = await supabase
      .from('workspace_references')
      .select('id, brand_name')
      .eq('id', referenceId)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (!reference) return api400('Referencia no encontrada');

    const startMs = Date.now();
    const results = await analyzeReferenceReels(supabase, referenceId, auth.workspaceId, 5);
    const latencyMs = Date.now() - startMs;

    // Log each successful analysis to llm_usage (mirrors competitor-analyze pattern).
    for (const r of results.filter((res) => res.success && res.tokensUsed > 0)) {
      const estimatedInput = Math.round(r.tokensUsed * 0.85);
      const estimatedOutput = r.tokensUsed - estimatedInput;
      const costUsd = calculateCost('gemini-2.5-flash', estimatedInput, estimatedOutput);
      await supabase.from('llm_usage').insert({
        workspace_id: auth.workspaceId,
        user_id: auth.userId,
        feature: 'reference-analysis',
        provider: 'google',
        model: 'gemini-2.5-flash',
        input_tokens: estimatedInput,
        output_tokens: estimatedOutput,
        total_tokens: r.tokensUsed,
        cost_usd: costUsd,
        latency_ms: Math.round(latencyMs / Math.max(1, results.length)),
      });
    }

    const { data: analyses } = await supabase
      .from('reference_reel_analysis')
      .select('*')
      .eq('reference_id', referenceId)
      .eq('workspace_id', auth.workspaceId);

    return apiSuccess({
      analyzed: results.filter((r) => r.success).length,
      total: results.length,
      analyses: analyses ?? [],
    });
  } catch (error) {
    console.error('[references/.../analyze-all] Error:', error);
    return api500('Error analizando reels');
  }
}
