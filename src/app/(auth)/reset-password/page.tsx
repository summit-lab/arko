'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { updatePassword } from '../actions'
import { Lock, Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  const t = useTranslations('auth.reset')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await updatePassword(formData)
    // Éxito → el server action redirige a "/". Solo manejamos el error acá.
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="glass-panel rounded-xl p-8 border border-border dark:border-white/10">
      <div className="flex flex-col items-center mb-8">
        <Image
          src="/logos/moka.svg"
          alt="Moka Logo"
          width={56}
          height={56}
          className="w-14 h-14 mb-3"
          priority
        />
        <h1 className="page-title text-2xl">{t('title')}</h1>
        <p className="text-muted-foreground text-sm mt-2 text-center">{t('subtitle')}</p>
      </div>

      <form action={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-500 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground/80">
            {t('passwordLabel')}
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={show ? 'text' : 'password'}
              required
              minLength={6}
              placeholder={t('passwordPlaceholder')}
              className="w-full bg-input/40 dark:bg-white/5 border border-border dark:border-white/10 rounded-lg px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm" className="text-sm font-medium text-foreground/80">
            {t('confirmLabel')}
          </label>
          <input
            id="confirm"
            name="confirm"
            type={show ? 'text' : 'password'}
            required
            minLength={6}
            placeholder={t('passwordPlaceholder')}
            className="w-full bg-input/40 dark:bg-white/5 border border-border dark:border-white/10 rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ color: '#ffffff' }}
          className="w-full flex items-center justify-center gap-2 bg-[#3a1f04] hover:bg-[#4a2a08] border border-[#3a1f04]/40 rounded-lg px-4 py-3 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="h-4 w-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          {loading ? t('submitting') : t('submit')}
        </button>

        <Link
          href="/forgot-password"
          className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('requestNew')}
        </Link>
      </form>
    </div>
  )
}
