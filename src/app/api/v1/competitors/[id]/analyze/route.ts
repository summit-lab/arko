/**
 * POST /api/v1/competitors/[id]/analyze
 * Analyzes unanalyzed competitor reels with Gemini (video) or Claude (fallback).
 * Extracts hooks, style, structure, CTA, strengths/weaknesses.
 * Logs AI costs to llm_usage with feature 'competitor-analysis'.
 */

export const maxDuration = 120;

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api400, api500 } from '@/lib/api/response';
import { analyzeCompetitorReels } from '@/services/competitor-analysis.service';
import { logLLMUsage, calculateCost } from '@/services/llm-usage.service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { id: competitorId } = await params;
    const supabase = await createClient();

    // Verify competitor belongs to workspace
    const { data: competitor } = await supabase
      .from('workspace_competitors')
      .select('id, name')
      .eq('id', competitorId)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (!competitor) {
      return api400('Competitor not found in this workspace');
    }

    // Ensure status is 'analyzing' (may already be set by scrape)
    await supabase
      .from('workspace_competitors')
      .update({ analysis_status: 'analyzing' })
      .eq('id', competitorId);

    const startMs = Date.now();
    const results = await analyzeCompetitorReels(supabase, competitorId, auth.workspaceId);
    const latencyMs = Date.now() - startMs;

    // Reset status to idle
    await supabase
      .from('workspace_competitors')
      .update({ analysis_status: 'idle' })
      .eq('id', competitorId);

    const successful = results.filter(r => r.success).length;
    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);

    // Log each successful analysis to llm_usage
    for (const r of results.filter(res => res.success && res.tokensUsed > 0)) {
      // Estimate input/output split (Gemini doesn't split cleanly in our flow)
      const estimatedInput = Math.round(r.tokensUsed * 0.85);
      const estimatedOutput = r.tokensUsed - estimatedInput;
      const costUsd = calculateCost('gemini-2.5-flash', estimatedInput, estimatedOutput);

      await supabase.from('llm_usage').insert({
        workspace_id: auth.workspaceId,
        user_id: auth.userId,
        feature: 'competitor-analysis',
        provider: 'google',
        model: 'gemini-2.5-flash',
        input_tokens: estimatedInput,
        output_tokens: estimatedOutput,
        total_tokens: r.tokensUsed,
        cost_usd: costUsd,
        latency_ms: Math.round(latencyMs / results.length),
      });
    }

    return apiSuccess({
      competitor_name: competitor.name,
      reels_analyzed: successful,
      reels_failed: results.length - successful,
      total_tokens: totalTokens,
      details: results,
    });
  } catch (error) {
    // Reset status on crash
    try {
      const supabase = await createClient();
      const { id: competitorId } = await params;
      await supabase
        .from('workspace_competitors')
        .update({ analysis_status: 'idle' })
        .eq('id', competitorId);
    } catch { /* best effort */ }

    console.error('[competitors/analyze] Error:', error);
    return api500('Error analyzing competitor reels');
  }
}
