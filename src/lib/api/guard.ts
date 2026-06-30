/**
 * Feature guard — el único guardián del dinero a nivel server.
 * Corre `authenticateRequest` y, si el tier del workspace NO tiene la feature,
 * devuelve 403 con el texto de la trampa ANTES de tocar LLM/Apify.
 *
 * La UI (FeatureLock) es defensa en profundidad / cosmética: aunque el usuario
 * fuerce la URL o pegue a la API directo, el server lee el plan fresco de la DB
 * en cada request y bloquea acá.
 */

import { authenticateRequest, isAuthError, type AuthResult } from './auth';
import { api403 } from './response';
import { hasFeature, TRAP, type Feature } from '@/lib/tier/config';

export async function requireFeature(
  request: Request,
  feature: Feature
): Promise<AuthResult | Response> {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  if (!hasFeature(auth.tier, feature)) {
    return api403(TRAP.description);
  }

  return auth;
}
