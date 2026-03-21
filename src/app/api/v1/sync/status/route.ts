/**
 * GET /api/v1/sync/status
 * Get sync job status for a workspace
 *
 * Query params:
 *   workspace_id (required)
 *   job_id (optional — specific job)
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api404, api500 } from '@/lib/api/response';

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const url = new URL(request.url);
    const jobId = url.searchParams.get('job_id');

    const supabase = await createClient();

    if (jobId) {
      // Specific job
      const { data: job, error } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('workspace_id', auth.workspaceId)
        .single();

      if (error || !job) return api404('Sync job no encontrado');
      return apiSuccess(job);
    }

    // Latest jobs
    const { data: jobs, error } = await supabase
      .from('sync_jobs')
      .select('*')
      .eq('workspace_id', auth.workspaceId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[sync/status] Error:', error);
      return api500();
    }

    return apiSuccess(jobs);
  } catch {
    return api500();
  }
}
