'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function login(formData: FormData) {
  const supabase = await createClient()

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

export async function registerWithInvite(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const token = formData.get('token') as string

  // Validate invitation token
  const { data: invitation, error: invError } = await supabase
    .rpc('validate_invitation', { p_token: token })

  if (invError || !invitation || invitation.length === 0) {
    return { error: 'Invitación inválida o expirada' }
  }

  // Verify email matches the invitation
  if (invitation[0].email !== email) {
    return { error: 'El email no coincide con la invitación' }
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

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
