'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { LOCALE_COOKIE, isLocale } from '@/i18n/config'
import { getAppUrl } from '@/lib/env'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // Clear stale workspace/role cookies before signing in. Previene que un
  // user loguee sobre la sesión de otro y herede el workspace_id del anterior
  // (ej. admin entró a un cliente via /admin panel y después otro user loguea
  // en el mismo browser → veía data del cliente con RLS denegando todo).
  const cookieStore = await cookies()
  cookieStore.delete('arko_workspace_id')
  cookieStore.delete('arko_user_role')
  cookieStore.delete('arko_onboarding_completed')

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/')
}

/**
 * Registro self-serve (funnel Demo). Sin invitación → handle_new_user crea el
 * workspace con plan='demo'. Devuelve { confirm: true } si Supabase requiere
 * confirmación por email (no hay sesión todavía).
 */
export async function register(formData: FormData) {
  const supabase = await createClient()

  const email = ((formData.get('email') as string) ?? '').trim().toLowerCase()
  const password = (formData.get('password') as string) ?? ''
  const fullName = ((formData.get('full_name') as string) ?? '').trim()

  if (!email || !email.includes('@')) return { error: 'Ingresá un email válido.' }
  if (password.length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres.' }

  // Limpiar cookies stale antes de crear la sesión nueva (mismo motivo que login()).
  const cookieStore = await cookies()
  cookieStore.delete('arko_workspace_id')
  cookieStore.delete('arko_user_role')
  cookieStore.delete('arko_onboarding_completed')

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName || email.split('@')[0], default_language: 'es' },
    },
  })

  if (error) {
    // Email ya registrado u otro error de Supabase.
    return { error: error.message }
  }

  // Con "Confirm email" activado, signUp no devuelve sesión → avisar al user.
  if (!data.session) {
    return { confirm: true }
  }

  // A onboarding (conectar Instagram), no al dashboard vacío: la primera
  // impresión de un demo sin datos era una pantalla de ceros sin CTA.
  redirect('/onboarding')
}

export async function registerWithInvite(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const token = formData.get('token') as string

  const t = await getTranslations('auth.errors')

  // Validate invitation token
  const { data: invitation, error: invError } = await supabase
    .rpc('validate_invitation', { p_token: token })

  if (invError || !invitation || invitation.length === 0) {
    return { error: t('invitationInvalid') }
  }

  // Verify email matches the invitation
  if (invitation[0].email !== email) {
    return { error: t('emailMismatch') }
  }

  // Look up the invitation's preselected language. Falls back to 'es' if the
  // RPC didn't return an invitation_id or the row was just created.
  let defaultLanguage: 'es' | 'en' = 'es'
  const invitationId = invitation[0].invitation_id as string | undefined
  if (invitationId) {
    const { data: row } = await supabase
      .from('invitations')
      .select('default_language')
      .eq('id', invitationId)
      .maybeSingle()
    if (row?.default_language && isLocale(row.default_language)) {
      defaultLanguage = row.default_language
    }
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        // Picked up by the auto-create-profile trigger if it reads raw_user_meta_data.
        default_language: defaultLanguage,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  // Ensure the new profile row carries the chosen language. The signup trigger
  // creates a profiles row with default 'es'; we update it explicitly so the
  // user lands in the right locale even if the trigger ignored the metadata.
  // Auth state propagates lazily; we look up the user by email.
  const { data: profileLookup } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (profileLookup?.id) {
    await supabase
      .from('profiles')
      .update({ language: defaultLanguage })
      .eq('id', profileLookup.id)
  }

  // Set the NEXT_LOCALE cookie so the post-signup redirect lands in the right
  // language without waiting for the next middleware pass.
  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, defaultLanguage, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })

  redirect('/')
}

export async function requestPasswordReset(formData: FormData) {
  const email = ((formData.get('email') as string) ?? '').trim()

  // Mensaje neutro siempre (anti-enumeración): nunca revelamos si el email existe.
  if (!email) return { ok: true }

  const supabase = await createClient()
  // El link del mail vuelve a /auth/confirm, que canjea el token y manda a
  // /reset-password con la sesión de recuperación ya activa.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAppUrl()}/auth/confirm?next=/reset-password`,
  })

  // No exponemos el error al cliente (anti-enumeración + no filtrar rate-limit del
  // email nativo de Supabase). Lo logueamos para diagnóstico.
  if (error) {
    console.error('[auth] resetPasswordForEmail:', error.message)
  }

  return { ok: true }
}

export async function updatePassword(formData: FormData) {
  const password = (formData.get('password') as string) ?? ''
  const confirm = (formData.get('confirm') as string) ?? ''
  const t = await getTranslations('auth.reset.errors')

  if (password.length < 6) return { error: t('tooShort') }
  if (password !== confirm) return { error: t('mismatch') }

  const supabase = await createClient()
  // updateUser usa la sesión de recuperación que dejó /auth/confirm en las cookies.
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    // Sin sesión de recuperación (link viejo, ya usado, o abierto en otro browser).
    const sessionMissing = /session|missing|jwt|token|expired/i.test(error.message)
    return { error: sessionMissing ? t('sessionMissing') : t('generic') }
  }

  // Contraseña nueva OK → limpiamos cookies cacheadas y entramos con la sesión fresca.
  const cookieStore = await cookies()
  cookieStore.delete('arko_workspace_id')
  cookieStore.delete('arko_user_role')
  cookieStore.delete('arko_onboarding_completed')
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // Clear cached cookies
  const cookieStore = await cookies()
  cookieStore.delete('arko_workspace_id')
  cookieStore.delete('arko_user_role')
  cookieStore.delete('arko_onboarding_completed')

  // Invalidar cache del layout: sin esto, en Next 16 con Turbopack el
  // server action puede devolver un payload RSC stale que el cliente
  // no sabe procesar (→ "An unexpected response was received from the
  // server" + React error #418 hydration mismatch al re-renderizar
  // con user=null pero layout todavía cacheado con user=X).
  revalidatePath('/', 'layout')

  redirect('/login')
}
