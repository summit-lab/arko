import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Deletion — Moka",
  description: "Data Deletion instructions and policy for Moka platform.",
};

export default function DataDeletionPage() {
  return (
    <main className="relative min-h-screen">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-[-20%] right-[10%] h-[600px] w-[600px] rounded-full bg-rose-500/[0.04] blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 md:px-16">
        <a href="/landing-arko" className="font-[family-name:var(--font-heading-local)] text-2xl tracking-tight">
          arko<span className="text-violet-400">.</span>
        </a>
      </header>

      {/* Content */}
      <article className="relative z-10 mx-auto max-w-3xl space-y-10 px-8 pt-10 pb-20">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.25em] text-white/40">
            Legal
          </p>
          <h1 className="font-[family-name:var(--font-heading-local)] text-3xl md:text-4xl">
            Data Deletion Policy
          </h1>
          <p className="mt-4 text-sm text-white/40">
            Last updated: March 27, 2026
          </p>
        </div>

        <div className="h-px bg-white/[0.06]" />

        <section className="space-y-4">
          <h2 className="font-[family-name:var(--font-heading-local)] text-xl text-white/90">
            How to Delete Your Data
          </h2>
          <div className="space-y-3 text-sm leading-relaxed text-white/60">
            <p>
              Moka provides multiple ways to remove your data from our platform.
              You can choose to disconnect a specific integration or delete your
              entire account.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-xl p-8">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
              <span className="font-[family-name:var(--font-heading-local)] text-lg text-violet-400">1</span>
            </div>
            <h3 className="font-[family-name:var(--font-heading-local)] text-lg">
              Disconnect Meta Account (Self-Service)
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              You can disconnect your Instagram/Facebook integration at any time
              from your Moka dashboard by going to <strong className="text-white/70">Settings</strong> and
              clicking <strong className="text-white/70">&quot;Disconnect Meta Account&quot;</strong>. This will:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-white/50">
              <li>Immediately invalidate and delete all stored OAuth tokens</li>
              <li>Stop all future data syncs from Instagram and Meta Ads</li>
              <li>Remove your connection to Meta&apos;s APIs</li>
            </ul>
            <p className="mt-3 text-sm text-white/40">
              Note: Previously synced analytics data will remain in your
              workspace for historical reference. To remove this data as well,
              see option 2 or 3.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-xl p-8">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
              <span className="font-[family-name:var(--font-heading-local)] text-lg text-cyan-400">2</span>
            </div>
            <h3 className="font-[family-name:var(--font-heading-local)] text-lg">
              Revoke Access via Facebook
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              You can also revoke Moka&apos;s access directly from Facebook:
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-6 text-sm text-white/50">
              <li>Go to your <a href="https://www.facebook.com/settings?tab=business_tools" className="text-violet-400 underline underline-offset-4" target="_blank" rel="noopener noreferrer">Facebook Settings &gt; Business Integrations</a></li>
              <li>Find &quot;Moka&quot; in the list of connected applications</li>
              <li>Click &quot;Remove&quot; to revoke all permissions</li>
            </ol>
            <p className="mt-3 text-sm text-white/40">
              This will immediately prevent Moka from accessing any of your
              Meta/Instagram data. Our system will detect the revocation and
              update your connection status accordingly.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-xl p-8">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
              <span className="font-[family-name:var(--font-heading-local)] text-lg text-rose-400">3</span>
            </div>
            <h3 className="font-[family-name:var(--font-heading-local)] text-lg">
              Complete Account &amp; Data Deletion
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              To request complete deletion of your Moka account and all
              associated data, send an email to:
            </p>
            <a
              href="mailto:support@usearko.io?subject=Data%20Deletion%20Request"
              className="mt-4 inline-block rounded-xl border border-white/[0.08] bg-white/[0.04] px-6 py-3 text-sm text-white/70 transition-colors hover:bg-white/[0.08]"
            >
              support@usearko.io
            </a>
            <p className="mt-4 text-sm text-white/50">
              Please include:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-white/50">
              <li>The email address associated with your Moka account</li>
              <li>Your Instagram username (if connected)</li>
              <li>Confirmation that you want all data permanently deleted</li>
            </ul>
            <p className="mt-4 text-sm text-white/50">
              Upon receiving your request, we will:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-white/50">
              <li>Confirm your identity via the registered email</li>
              <li>Delete all stored OAuth tokens</li>
              <li>Delete all synced Instagram, YouTube, and Ads data</li>
              <li>Delete all AI conversation history</li>
              <li>Delete your user account and workspace</li>
              <li>Send confirmation of deletion within 30 days</li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-[family-name:var(--font-heading-local)] text-xl text-white/90">
            What Data Is Deleted
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-xl p-8">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-white/40">
                  <th className="pb-4 pr-6">Data Type</th>
                  <th className="pb-4 pr-6">Disconnect</th>
                  <th className="pb-4">Full Deletion</th>
                </tr>
              </thead>
              <tbody className="text-white/60">
                <tr className="border-b border-white/[0.04]">
                  <td className="py-3 pr-6">OAuth access tokens</td>
                  <td className="py-3 pr-6 text-emerald-400">Deleted</td>
                  <td className="py-3 text-emerald-400">Deleted</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="py-3 pr-6">Instagram profile data</td>
                  <td className="py-3 pr-6 text-white/40">Retained</td>
                  <td className="py-3 text-emerald-400">Deleted</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="py-3 pr-6">Media & engagement metrics</td>
                  <td className="py-3 pr-6 text-white/40">Retained</td>
                  <td className="py-3 text-emerald-400">Deleted</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="py-3 pr-6">Ads campaign data</td>
                  <td className="py-3 pr-6 text-white/40">Retained</td>
                  <td className="py-3 text-emerald-400">Deleted</td>
                </tr>
                <tr className="border-b border-white/[0.04]">
                  <td className="py-3 pr-6">AI conversation history</td>
                  <td className="py-3 pr-6 text-white/40">Retained</td>
                  <td className="py-3 text-emerald-400">Deleted</td>
                </tr>
                <tr>
                  <td className="py-3 pr-6">User account & workspace</td>
                  <td className="py-3 pr-6 text-white/40">Retained</td>
                  <td className="py-3 text-emerald-400">Deleted</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-[family-name:var(--font-heading-local)] text-xl text-white/90">
            Contact
          </h2>
          <p className="text-sm leading-relaxed text-white/60">
            For any questions about data deletion or privacy, contact us at{" "}
            <a href="mailto:support@usearko.io" className="text-violet-400 underline underline-offset-4">
              support@usearko.io
            </a>
            .
          </p>
        </section>
      </article>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] px-8 py-10 text-center">
        <p className="text-xs text-white/30">
          &copy; {new Date().getFullYear()} Moka by Summit Lab. All rights reserved.
        </p>
        <div className="mt-3 flex justify-center gap-6 text-xs text-white/40">
          <a href="/landing-arko" className="hover:text-white/70 transition-colors">
            About Moka
          </a>
          <a href="/privacy" className="hover:text-white/70 transition-colors">
            Privacy Policy
          </a>
        </div>
      </footer>
    </main>
  );
}
