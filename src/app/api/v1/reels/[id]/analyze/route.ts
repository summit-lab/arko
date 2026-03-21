/**
 * POST /api/v1/reels/[id]/analyze
 * Trigger on-demand AI diagnosis for a reel (PRD 9.2-9.3)
 * This is the "Generar análisis" button in the Ficha de Reel (PRD 8.2 Section 5)
 */

import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, isAuthError } from '@/lib/api/auth';
import { apiSuccess, api404, api400, api500 } from '@/lib/api/response';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const supabase = await createClient();

    // Verify reel exists and belongs to workspace
    const { data: reel, error: reelError } = await supabase
      .from('reels')
      .select('id, sync_status')
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId)
      .single();

    if (reelError || !reel) {
      return api404('Reel no encontrado');
    }

    // Check that reel has been analyzed (transcript + narrative must exist)
    const { data: transcript } = await supabase
      .from('reel_transcripts')
      .select('processing_status')
      .eq('reel_id', id)
      .single();

    if (!transcript || transcript.processing_status !== 'completed') {
      return api400('El reel necesita transcripción completada antes de generar diagnóstico');
    }

    // Create diagnostic record in pending state
    const { data: diagnostic, error: diagError } = await supabase
      .from('reel_diagnostics')
      .insert({
        reel_id: id,
        workspace_id: auth.workspaceId,
        processing_status: 'pending',
      })
      .select()
      .single();

    if (diagError) {
      console.error('[analyze] Create diagnostic error:', diagError);
      return api500();
    }

    // TODO: Trigger Edge Function to process the diagnosis asynchronously
    // For now, return the pending diagnostic record
    // In production: await supabase.functions.invoke('process-diagnosis', { body: { diagnostic_id: diagnostic.id } })

    return apiSuccess({
      diagnostic_id: diagnostic.id,
      status: 'pending',
      message: 'Diagnóstico en cola de procesamiento',
    }, 202);
  } catch {
    return api500();
  }
}
