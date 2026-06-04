'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { requestPasswordReset } from '../actions'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgot')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    await requestPasswordReset(formData)
    // Siempre mostramos el mismo estado de éxito (no revelamos si el email existe).
    setSent(true)
    setLoading(false)
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

      {sent ? (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">{t('sentTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('sentBody')}</p>
          </div>
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToLogin')}
          </Link>
        </div>
      ) : (
        <form action={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground/80">
              {t('emailLabel')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder={t('emailPlaceholder')}
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
              <Mail className="h-4 w-4" />
            )}
            {loading ? t('submitting') : t('submit')}
          </button>

          <Link
            href="/login"
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToLogin')}
          </Link>
        </form>
      )}
    </div>
  )
}
