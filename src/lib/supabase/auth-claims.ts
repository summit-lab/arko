import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resuelve el usuario autenticado priorizando `getClaims()`, que valida el JWT
 * LOCALMENTE (ES256 via JWKS) — sin round-trip a Auth en el caso comun de sesion
 * valida. Eso saca ~0.2-0.6s del critical path de cada request/render y descomprime
 * el cap de 10 conexiones del Auth server bajo concurrencia (100+ usuarios).
 *
 * Si no hay claims (sesion ausente/expirada o algun edge case de getClaims), cae a
 * `getUser()` (round-trip) para CONFIRMAR antes de tratar a alguien como deslogueado:
 * asi el cambio nunca deja a un usuario valido afuera. getClaims/getSession tambien
 * dispara el auto-refresh del SSR client, asi que el refresh de cookies se mantiene.
 */
export async function getAuthUser(
  supabase: SupabaseClient,
): Promise<{ id: string; email: string | null } | null> {
  try {
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims as { sub?: string; email?: string } | undefined;
    if (claims?.sub) {
      return { id: claims.sub, email: claims.email ?? null };
    }
  } catch {
    /* cae a getUser abajo */
  }

  const { data } = await supabase.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}
