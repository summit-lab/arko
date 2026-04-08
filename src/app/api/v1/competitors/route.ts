/**
 * GET /api/v1/competitors
 * Returns all competitors for the workspace with their reels + analysis data.
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api500 } from '@/lib/api/response';

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const supabase = await createClient();

    const { data: competitors, error } = await supabase
      .from('workspace_competitors')
      .select(`
        id, name, ig_url, why_better, scraped_data, last_scraped_at, analysis_status,
        competitor_reels (
          id, short_code, permalink, caption,
          likes_count, comments_count, views_count, shares_count,
          duration_seconds, published_at, thumbnail_url,
          hashtags, music_artist, music_name,
          competitor_reel_analysis (
            hook_text, hook_type, narrative_structure, content_type,
            cta_text, cta_type, topic_cluster, style_notes,
            strengths, weaknesses, ai_summary, model_used
          )
        ),
        competitor_follower_snapshots (
          snapshot_date, follower_count
        )
      `)
      .eq('workspace_id', auth.workspaceId)
      .order('created_at', { ascending: true });

    if (error) {
      return api500('Error cargando competidores');
    }

    return apiSuccess({ competitors: competitors ?? [] });
  } catch (error) {
    console.error('[competitors] GET Error:', error);
    return api500('Error cargando competidores');
  }
}
