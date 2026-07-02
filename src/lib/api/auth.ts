/**
 * API Auth helpers — Extract and validate user from request
 * Used by all protected API routes
 */

import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/auth-claims';
import { api401, api403 } from './response';
import { resolveTier, type Tier } from '@/lib/tier/config';

export interface AuthResult {
  userId: string;
  workspaceId: string;
  /** Tier efectivo (con auto-downgrade de trial vencido aplicado). */
  tier: Tier;
}

/**
 * Validate the request has a valid Supabase session and extract workspace_id.
 * workspace_id comes from query param or header `x-workspace-id`.
 */
export async function authenticateRequest(
  request: Request
): Promise<AuthResult | Response> {
  const supabase = await createClient();
  // getClaims (validación local del JWT) en vez de getUser (round-trip a
  // GoTrue en CADA request de las 38 rutas — Auth está capado a ~10
  // conexiones y era el cuello de botella con 100 usuarios navegando).
  // getAuthUser cae a getUser() si no hay claims → nadie válido queda afuera.
  const user = await getAuthUser(supabase);

  if (!user) {
    return api401();
  }

  // Get workspace_id from header or URL search params
  const url = new URL(request.url);
  const workspaceId =
    request.headers.get('x-workspace-id') ||
    url.searchParams.get('workspace_id');

  if (!workspaceId) {
    return api403('Falta workspace_id en la request');
  }

  // Verify user owns this workspace + derive tier (plan + trial vencido)
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('id, plan, trial_ends_at')
    .eq('id', workspaceId)
    .eq('owner_id', user.id)
    .single();

  if (wsError || !workspace) {
    return api403('No tienes acceso a este workspace');
  }

  return {
    userId: user.id,
    workspaceId,
    tier: resolveTier(workspace.plan, workspace.trial_ends_at),
  };
}

/**
 * Type guard to check if authenticateRequest returned an error Response
 */
export function isAuthError(result: AuthResult | Response): result is Response {
  return result instanceof Response;
}
