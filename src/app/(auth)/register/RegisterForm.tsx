'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { UserPlus, User, Lock, Mail, Eye, EyeOff, MailCheck } from 'lucide-react'
import { register } from '../actions'

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await register(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else if (result?.confirm) {
      // Email confirmation requerida → mostramos aviso (no hay redirect server-side).
      setConfirmSent(true)
      setLoading(false)
    }
    // Si no hay error ni confirm → redirect server-side al dashboard.
  }

  if (confirmSent) {
    return (
      <div className="glass-panel rounded-xl p-8 border border-border dark:border-white/10 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15">
          <MailCheck className="h-7 w-7 text-emerald-400" />
        </div>
        <h1 className="page-title text-2xl">Revisá tu email</h1>
        <p className="text-muted-foreground text-sm mt-3 leading-relaxed">
          Te enviamos un link para confirmar tu cuenta. Hacé click ahí y entrás a tu Moka.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm text-foreground/70 hover:text-foreground transition-colors">
          Volver al login
        </Link>
      </div>
    )
  }

  return (
    <div className="glass-panel rounded-xl p-8 border border-border dark:border-white/10">
      <div className="flex flex-col items-center mb-8">
        <Image src="/logos/moka.svg" alt="Moka Logo" width={56} height={56} className="w-14 h-14 mb-3" priority />
        <h1 className="page-title text-2xl">Probá Moka gratis</h1>
        <p className="text-muted-foreground text-sm mt-2 text-center">
          Conectá tu Instagram y mirá tu dashboard al instante.
        </p>
      </div>

      <form action={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-500 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="full_name" className="text-sm font-medium text-foreground/80">Nombre</label>
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              id="full_name" name="full_name" type="text" required placeholder="Tu nombre"
              className="w-full bg-input/40 dark:bg-white/5 border border-border dark:border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground/80">Email</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              id="email" name="email" type="email" required placeholder="tu@email.com" autoComplete="email"
              className="w-full bg-input/40 dark:bg-white/5 border border-border dark:border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground/80">Contraseña</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              id="password" name="password" type={showPassword ? 'text' : 'password'} required minLength={6} placeholder="Mínimo 6 caracteres"
              className="w-full bg-input/40 dark:bg-white/5 border border-border dark:border-white/10 rounded-lg pl-10 pr-12 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit" disabled={loading} style={{ color: '#ffffff' }}
          className="w-full flex items-center justify-center gap-2 bg-[#3a1f04] hover:bg-[#4a2a08] border border-[#3a1f04]/40 rounded-lg px-4 py-3 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="h-4 w-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {loading ? 'Creando tu cuenta…' : 'Crear mi cuenta'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-foreground hover:underline">Iniciá sesión</Link>
        </p>
      </div>
    </div>
  )
}
