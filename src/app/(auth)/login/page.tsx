'use client'

import { useState } from 'react'
import Image from 'next/image'
import { login } from '../actions'
import { LogIn, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="glass-panel rounded-xl p-8 border border-border dark:border-white/10">
      <div className="flex flex-col items-center mb-8">
        <Image
          src="/Arcadia Logo.png"
          alt="Moka Logo"
          width={160}
          height={36}
          className="h-auto w-auto mb-6 dark:brightness-200"
          priority
        />
        <h1 className="page-title text-2xl">Welcome back</h1>
        <p className="text-muted-foreground text-sm mt-2">Sign in to your account</p>
      </div>

      <form action={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-500 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground/80">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="tu@email.com"
            className="w-full bg-input/40 dark:bg-white/5 border border-border dark:border-white/10 rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground/80">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••••"
              className="w-full bg-input/40 dark:bg-white/5 border border-border dark:border-white/10 rounded-lg px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:opacity-90 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 border border-border dark:border-white/10 rounded-lg px-4 py-3 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="h-4 w-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Acceso solo por invitación.
        </p>
      </div>
    </div>
  )
}
