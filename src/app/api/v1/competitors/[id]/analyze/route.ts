/**
 * POST /api/v1/competitors/[id]/analyze
 * Analyzes unanalyzed competitor reels with Gemini (video) or Claude (fallback).
 * Extracts hooks, style, structure, CTA, strengths/weaknesses.
 * Logs AI costs to llm_usage with feature 'competitor-analysis'.
 */

// Vercel Pro hard cap is 300s. 5 reels in parallel ≈ 30-90s, so 300s leaves
// plenty of headroom for slow Gemini retries / fallback to text-only mode.
export const maxDuration = 300;

import { createClient } from '@/lib/supabase/server';
import { isAuthError } from '@/lib/api/auth';
import { requireFeature } from '@/lib/api/guard';
import { assertCredits, isUnlimitedWorkspace } from '@/lib/api/credit-guard';
import { apiSuccess, api400, api500 } from '@/lib/api/response';
import { analyzeCompetitorReels } from '@/services/competitor-analysis.service';
import { logLLMUsage, calculateCost } from '@/services/llm-usage.service';
import { cfg } from '@/lib/tier/config';
import { arToday } from '@/lib/credits';

const MAX_BULK_REEL_IDS = 5;

interface AnalyzeBody {
  reelIds?: string[];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireFeature(request, 'competitors');
    if (isAuthError(auth)) return auth;

    const { id: competitorId } = await params;
    const supabase = await createClient();

    const over = await assertCredits(supabase, auth);
    if (over) return over;

    // Techo diario de la CADENA de análisis: la UI puede encadenar requests de
    // a 5; sin este cap un workspace podía analizar 50+ reels/día (~340
    // coins). standard = 15 reels/día, pro = 25 (maxBulkAnalyze × 5). El día
    // resetea a medianoche AR, igual que las Moka Coins.
    // Exento: billetera unlimited (override de admin, ej. Francisco).
    if (!(await isUnlimitedWorkspace(supabase, auth.workspaceId))) {
      const chainCap = cfg(auth.tier).maxBulkAnalyze * MAX_BULK_REEL_IDS;
      const { count: analysesToday } = await supabase
        .from('llm_usage')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', auth.workspaceId)
        .eq('feature', 'competitor-analysis')
        .gt('created_at', `${arToday()}T00:00:00-03:00`);
      if ((analysesToday ?? 0) >= chainCap) {
        return api400(`Alcanzaste el límite diario de análisis de competidores (${chainCap} reels). Se renueva a la medianoche.`);
      }
    }

    // Optional reelIds[] in body — when present, analyze exactly those reels
    // (the user picked them with the multi-select UI). Capped server-side at
    // MAX_BULK_REEL_IDS to keep cost predictable.
    let reelIds: string[] | undefined;
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = (await request.json().catch(() => ({}))) as AnalyzeBody;
      if (Array.isArray(body.reelIds)) {
        reelIds = body.reelIds.slice(0, MAX_BULK_REEL_IDS).filter((id) => typeof id === 'string');
        if (reelIds.length === 0) reelIds = undefined;
      }
    }

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

    // Ensure status is 'analyzing' (may already be set by scrape).
    // analysis_started_at lo lee el watchdog pg_cron para distinguir
    // runs legítimas en curso de rows stuck por crash/timeout.
    await supabase
      .from('workspace_competitors')
      .update({ analysis_status: 'analyzing', analysis_started_at: new Date().toISOString() })
      .eq('id', competitorId);

    const startMs = Date.now();
    const results = await analyzeCompetitorReels(supabase, competitorId, auth.workspaceId, reelIds);
    const latencyMs = Date.now() - startMs;

    // Reset status to idle
    await supabase
      .from('workspace_competitors')
      .update({ analysis_status: 'idle', analysis_started_at: null })
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
        .update({ analysis_status: 'idle', analysis_started_at: null })
        .eq('id', competitorId);
    } catch { /* best effort */ }

    console.error('[competitors/analyze] Error:', error);
    return api500('Error analyzing competitor reels');
  }
}
