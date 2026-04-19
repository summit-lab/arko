/**
 * GET /api/v1/youtube/video-metrics?video_id=<uuid>
 * Returns yt_video_metrics_daily rows for a specific video in the workspace.
 * Ordered by metric_date ASC (for time-series charts).
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api500 } from '@/lib/api/response';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('video_id');

    if (!videoId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'video_id is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('yt_video_metrics_daily')
      .select('metric_date, view_count, like_count, comment_count')
      .eq('video_id', videoId)
      .eq('workspace_id', auth.workspaceId)
      .order('metric_date', { ascending: true });

    if (error) {
      console.error('[youtube/video-metrics] Supabase error:', error);
      return api500();
    }

    return apiSuccess({ metrics: data ?? [] });
  } catch (err) {
    console.error('[youtube/video-metrics] Error:', err);
    return api500();
  }
}
