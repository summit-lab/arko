import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moka — AI Marketing Director",
  description:
    "AI-powered marketing intelligence for high-earning content creators and personal brands.",
  robots: "noindex, nofollow",
};

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-xl p-8 ${className}`}
    >
      {children}
    </div>
  );
}

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-[family-name:var(--font-heading-local)] text-4xl md:text-5xl bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
        {value}
      </p>
      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/40">{label}</p>
    </div>
  );
}

export default function LandingArkoPage() {
  return (
    <main className="relative overflow-hidden">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-[-20%] left-[10%] h-[700px] w-[700px] rounded-full bg-violet-500/[0.07] blur-[140px]" />
        <div className="absolute top-[30%] right-[-5%] h-[500px] w-[500px] rounded-full bg-cyan-500/[0.05] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[30%] h-[600px] w-[600px] rounded-full bg-rose-500/[0.04] blur-[130px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 md:px-16">
        <div className="font-[family-name:var(--font-heading-local)] text-2xl tracking-tight">
          arko<span className="text-violet-400">.</span>
        </div>
        <nav className="hidden items-center gap-8 text-sm text-white/50 md:flex">
          <a href="#features" className="transition-colors hover:text-white/80">Features</a>
          <a href="#how-it-works" className="transition-colors hover:text-white/80">How it works</a>
          <a href="#security" className="transition-colors hover:text-white/80">Security</a>
          <a
            href="mailto:support@usearko.io"
            className="rounded-full border border-white/[0.1] bg-white/[0.04] px-5 py-2 text-white/70 transition-all hover:bg-white/[0.08] hover:text-white"
          >
            Get early access
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-5xl px-8 pt-24 pb-20 text-center md:pt-36 md:pb-28">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-xs text-white/50">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Now in private beta
        </div>
        <h1 className="font-[family-name:var(--font-heading-local)] text-5xl leading-[1.1] md:text-7xl md:leading-[1.05]">
          Stop guessing.
          <br />
          <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
            Start knowing.
          </span>
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-white/50 md:text-xl">
          Moka is the AI Marketing Director that unifies your Instagram, YouTube,
          and Meta Ads data into one intelligent dashboard &mdash; so every decision
          is backed by real performance data.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="mailto:support@usearko.io?subject=Early%20Access%20Request"
            className="rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-8 py-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Request early access
          </a>
          <a
            href="#features"
            className="rounded-full border border-white/[0.1] bg-white/[0.03] px-8 py-3.5 text-sm text-white/60 transition-all hover:bg-white/[0.06] hover:text-white/80"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Social proof stats */}
      <section className="relative z-10 mx-auto max-w-4xl px-8 pb-24">
        <GlassCard className="flex flex-col items-center justify-around gap-8 py-10 sm:flex-row sm:gap-4">
          <StatBlock value="50K+" label="Media analyzed" />
          <div className="hidden h-10 w-px bg-white/[0.06] sm:block" />
          <StatBlock value="10M+" label="Metrics tracked" />
          <div className="hidden h-10 w-px bg-white/[0.06] sm:block" />
          <StatBlock value="24/7" label="AI insights" />
        </GlassCard>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-8 pb-24">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-violet-400/70">Features</p>
          <h2 className="font-[family-name:var(--font-heading-local)] text-3xl md:text-4xl">
            Everything you need to grow
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/40">
            One platform that connects all your marketing data and turns it into
            actionable intelligence.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <GlassCard className="group transition-all hover:border-violet-500/20 hover:bg-white/[0.06]">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-500/5">
              <svg className="h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-heading-local)] text-lg">Instagram Intelligence</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/45">
              Auto-sync Reels, Posts, and Carousels. Track views, reach, engagement,
              and follower growth with daily precision. Know exactly what content
              drives results.
            </p>
          </GlassCard>

          <GlassCard className="group transition-all hover:border-cyan-500/20 hover:bg-white/[0.06]">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5">
              <svg className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-heading-local)] text-lg">YouTube Intelligence</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/45">
              Analyze video performance, audience retention, and content engagement.
              Discover what drives subscriber growth and maximize your watch time.
            </p>
          </GlassCard>

          <GlassCard className="group transition-all hover:border-rose-500/20 hover:bg-white/[0.06]">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/20 to-rose-500/5">
              <svg className="h-6 w-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-heading-local)] text-lg">Ads Intelligence</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/45">
              Connect your Meta Ads and see campaign performance alongside organic
              metrics. Track spend, CPC, CPM, and ROAS across all campaigns.
            </p>
          </GlassCard>

          <GlassCard className="group transition-all hover:border-emerald-500/20 hover:bg-white/[0.06]">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
              <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-heading-local)] text-lg">Customer Voice</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/45">
              Unify feedback from forms and sales calls. Understand what your
              audience truly wants and align your content with real demand signals.
            </p>
          </GlassCard>

          <GlassCard className="group transition-all hover:border-violet-500/20 hover:bg-white/[0.06]">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-500/5">
              <svg className="h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-heading-local)] text-lg">AI Agents</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/45">
              Chat with specialized AI agents trained on your real data. Get content
              scripts, strategy recommendations, and insights backed by your actual
              metrics.
            </p>
          </GlassCard>

          <GlassCard className="group transition-all hover:border-cyan-500/20 hover:bg-white/[0.06]">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5">
              <svg className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-heading-local)] text-lg">Unified Dashboard</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/45">
              See all your marketing data in one place. Compare organic vs paid
              performance, track trends over 7, 30, or 90 days, and spot opportunities
              instantly.
            </p>
          </GlassCard>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative z-10 mx-auto max-w-5xl px-8 pb-24">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-cyan-400/70">How it works</p>
          <h2 className="font-[family-name:var(--font-heading-local)] text-3xl md:text-4xl">
            Up and running in 3 minutes
          </h2>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
              <span className="font-[family-name:var(--font-heading-local)] text-xl text-violet-400">1</span>
            </div>
            <h3 className="font-[family-name:var(--font-heading-local)] text-base">Connect your accounts</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/40">
              Link your Instagram, YouTube, and Meta Ads with a secure OAuth flow.
              We never see your passwords.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
              <span className="font-[family-name:var(--font-heading-local)] text-xl text-cyan-400">2</span>
            </div>
            <h3 className="font-[family-name:var(--font-heading-local)] text-base">We sync your data</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/40">
              Moka automatically pulls your metrics, media, and campaign data.
              Everything stays encrypted and isolated in your private workspace.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
              <span className="font-[family-name:var(--font-heading-local)] text-xl text-emerald-400">3</span>
            </div>
            <h3 className="font-[family-name:var(--font-heading-local)] text-base">Get AI-powered insights</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/40">
              Access dashboards, trend analysis, and AI agents that help you make
              smarter marketing decisions based on real data.
            </p>
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="relative z-10 mx-auto max-w-5xl px-8 pb-24">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-emerald-400/70">Security</p>
          <h2 className="font-[family-name:var(--font-heading-local)] text-3xl md:text-4xl">
            Your data is safe with us
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/40">
            We take security seriously. Your data is encrypted, isolated, and never
            shared with anyone.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <GlassCard>
            <h3 className="font-[family-name:var(--font-heading-local)] text-base text-emerald-400">AES-256 Encryption</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              All OAuth tokens are encrypted at rest using AES-256 via PostgreSQL
              pgcrypto. Your credentials are never stored in plaintext.
            </p>
          </GlassCard>
          <GlassCard>
            <h3 className="font-[family-name:var(--font-heading-local)] text-base text-emerald-400">Workspace Isolation</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              Row-Level Security (RLS) ensures every workspace is completely
              isolated. No user can ever access another&apos;s data.
            </p>
          </GlassCard>
          <GlassCard>
            <h3 className="font-[family-name:var(--font-heading-local)] text-base text-emerald-400">Read-Only Access</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              Moka only reads your data &mdash; we never post, modify, or delete
              anything on your accounts. All API access is strictly read-only.
            </p>
          </GlassCard>
          <GlassCard>
            <h3 className="font-[family-name:var(--font-heading-local)] text-base text-emerald-400">Disconnect Anytime</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              You can revoke access at any time from your dashboard or directly
              from Facebook settings. All tokens are immediately invalidated.
            </p>
          </GlassCard>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-3xl px-8 pb-24 text-center">
        <GlassCard className="py-14">
          <h2 className="font-[family-name:var(--font-heading-local)] text-3xl md:text-4xl">
            Ready to grow smarter?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/45">
            Join the private beta and start making data-driven marketing decisions
            today.
          </p>
          <a
            href="mailto:support@usearko.io?subject=Early%20Access%20Request"
            className="mt-8 inline-block rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-10 py-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Request early access
          </a>
        </GlassCard>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] px-8 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
          <div>
            <div className="font-[family-name:var(--font-heading-local)] text-lg">
              arko<span className="text-violet-400">.</span>
            </div>
            <p className="mt-1 text-xs text-white/30">
              &copy; {new Date().getFullYear()} Summit Lab. All rights reserved.
            </p>
          </div>
          <div className="flex gap-8 text-xs text-white/40">
            <a href="/privacy" className="transition-colors hover:text-white/70">
              Privacy Policy
            </a>
            <a href="/data-deletion" className="transition-colors hover:text-white/70">
              Data Deletion
            </a>
            <a href="mailto:support@usearko.io" className="transition-colors hover:text-white/70">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
