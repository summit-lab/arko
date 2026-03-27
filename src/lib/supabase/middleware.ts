import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Public routes: no auth required
const PUBLIC_ROUTES = ['/login', '/invite', '/api/v1/health', '/api/v1/auth/meta/callback', '/api/v1/auth/meta/deauthorize', '/api/v1/auth/meta/data-deletion', '/landing-arko', '/privacy', '/data-deletion']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very
  // hard to debug issues with users being randomly logged out.

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
  const isApiRoute = pathname.startsWith('/api/')

  // Block /register — registration only via /invite/[token]
  if (pathname === '/register') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If not authenticated and trying to access protected route → redirect to login
  if (!user && !isPublicRoute && !isApiRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If authenticated and trying to access login page → redirect to dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Admin route protection: only role='admin' can access /admin/*
  if (user && pathname.startsWith('/admin')) {
    let userRole: string = request.cookies.get('arko_user_role')?.value ?? ''
    if (!userRole) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      userRole = profile?.role ?? 'user'
      supabaseResponse.cookies.set('arko_user_role', userRole, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60, // 1 hour (shorter TTL for security)
        path: '/',
      })
    }
    if (userRole !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  // Cache workspace_id and user role in cookies
  if (user) {
    if (!request.cookies.get('arko_workspace_id')) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .maybeSingle()

      if (workspace) {
        supabaseResponse.cookies.set('arko_workspace_id', workspace.id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24, // 24 hours
          path: '/',
        })
      }
    }

    // Cache role for admin checks
    if (!request.cookies.get('arko_user_role')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile) {
        supabaseResponse.cookies.set('arko_user_role', profile.role, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60, // 1 hour
          path: '/',
        })
      }
    }

    // ── Onboarding gate: block features until ADN is complete ──
    const isOnboardingRoute = pathname.startsWith('/onboarding')
    const isAdminRoute = pathname.startsWith('/admin')

    if (!isOnboardingRoute && !isAdminRoute && !isApiRoute) {
      let onboardingDone = request.cookies.get('arko_onboarding_completed')?.value

      // Always re-check DB when cookie is missing or "false" (it may have been completed since last check)
      if (onboardingDone !== 'true') {
        const wsId = request.cookies.get('arko_workspace_id')?.value
        if (wsId) {
          const { data: ws } = await supabase
            .from('workspaces')
            .select('onboarding_completed')
            .eq('id', wsId)
            .maybeSingle()

          onboardingDone = ws?.onboarding_completed ? 'true' : 'false'
          supabaseResponse.cookies.set('arko_onboarding_completed', onboardingDone, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: onboardingDone === 'true' ? 60 * 60 * 24 : 60, // 24h if done, 60s if not
            path: '/',
          })
        }
      }

      // Note: we no longer redirect — the layout shows an ADN alert banner
      // and specific features (AI Agents) are blocked in-page.
    }
  }

  // Pass pathname to layout via header
  supabaseResponse.headers.set('x-pathname', pathname)

  return supabaseResponse
}
