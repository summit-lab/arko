/**
 * GET /api/v1/youtube/video-metrics?video_id=<uuid>
 * Returns yt_video_metrics_daily rows for a specific video in the workspace.
 * Ordered by metric_date ASC (for time-series charts).
 *
 * `view_count`, `like_count`, `comment_count` are cumulative lifetime totals (what YouTube returns).
 * `delta_views`, `delta_likes`, `delta_comments` are daily deltas computed from the previous day.
 * For the first row in the series, deltas are 0 (no prior snapshot to diff).
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api500 } from '@/lib/api/response';
import { NextResponse } from 'next/server';

interface DailyRow {
  metric_date: string;
  view_count: number;
  like_count: number;
  comment_count: number;
}

interface DailyRowWithDeltas extends DailyRow {
  delta_views: number;
  delta_likes: number;
  delta_comments: number;
}

function addDeltas(rows: DailyRow[]): DailyRowWithDeltas[] {
  return rows.map((row, i) => {
    const prev = i > 0 ? rows[i - 1] : null;
    return {
      ...row,
      delta_views: prev ? Math.max(0, row.view_count - prev.view_count) : 0,
      delta_likes: prev ? Math.max(0, row.like_count - prev.like_count) : 0,
      delta_comments: prev ? Math.max(0, row.comment_count - prev.comment_count) : 0,
    };
  });
}

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

    return apiSuccess({ metrics: addDeltas((data ?? []) as DailyRow[]) });
  } catch (err) {
    console.error('[youtube/video-metrics] Error:', err);
    return api500();
  }
}
