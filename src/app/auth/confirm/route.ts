/**
 * GET /auth/confirm
 * Aterriza el link del mail de recuperación de contraseña. Canjea el token
 * (PKCE `code` o `token_hash` según el template del mail) → setea la sesión de
 * recuperación en cookies → redirige a /reset-password para elegir nueva clave.
 *
 * Ruta PÚBLICA (ver PUBLIC_ROUTES en supabase/middleware.ts): el usuario todavía
 * no tiene sesión cuando aterriza acá, así que el middleware no debe patearlo.
 */

import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  // Sanitizar `next`: SOLO paths relativos (empiezan con "/"), para evitar
  // open-redirect (?next=https://evil.com tras setear una sesión válida).
  const nextParam = url.searchParams.get('next') ?? '/reset-password';
  const next = nextParam.startsWith('/') ? nextParam : '/reset-password';

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL('/login?error=reset_link_invalid', request.url));
}
