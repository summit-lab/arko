import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Moka",
  description: "Terms of Service for Moka, the AI Marketing Director platform.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-[family-name:var(--font-heading-local)] text-xl text-white/90">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-white/60">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="relative min-h-screen">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-[-20%] left-[10%] h-[600px] w-[600px] rounded-full bg-violet-500/[0.04] blur-[120px]" />
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
            Terms of Service
          </h1>
          <p className="mt-4 text-sm text-white/40">
            Last updated: April 20, 2026
          </p>
        </div>

        <div className="h-px bg-white/[0.06]" />

        <Section title="1. Acceptance of Terms">
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your use of Moka (&quot;Service&quot;), a SaaS analytics platform developed by Summit Lab and accessible at www.usemoka.io. By creating an account, accepting an invitation, or otherwise using the Service, you agree to these Terms. If you do not agree, you may not use the Service.
          </p>
        </Section>

        <Section title="2. The Service">
          <p>
            Moka provides AI-powered marketing analytics for content creators and personal brands. The Service connects to your social media accounts (Instagram, YouTube, Meta Ads) via official OAuth APIs to retrieve performance metrics, which it displays in dashboards, summarizes via AI, and makes available within your private workspace.
          </p>
          <p>
            We may add, change, or remove features at any time. Core functionality will be preserved for active subscriptions; material changes will be communicated via email or in-product notice.
          </p>
        </Section>

        <Section title="3. Accounts and Eligibility">
          <p>
            You must be at least 18 years old to use Moka. You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. Notify us immediately at <a href="mailto:support@usemoka.io" className="text-violet-400 underline underline-offset-4">support@usemoka.io</a> if you suspect unauthorized access.
          </p>
          <p>
            Each workspace is isolated via PostgreSQL Row-Level Security. Sharing credentials or circumventing workspace boundaries is prohibited.
          </p>
        </Section>

        <Section title="4. Acceptable Use">
          <p>You agree NOT to:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Use the Service for any unlawful purpose or in violation of applicable laws</li>
            <li>Attempt to reverse-engineer, decompile, or extract source code</li>
            <li>Interfere with or disrupt the Service, servers, or networks</li>
            <li>Scrape, crawl, or mass-extract data from the Service</li>
            <li>Use the Service to harass, defame, or harm others</li>
            <li>Resell, sublicense, or white-label the Service without written permission</li>
            <li>Upload or process data you do not have the right to use</li>
            <li>Circumvent workspace isolation or attempt to access other users&apos; data</li>
          </ul>
        </Section>

        <Section title="5. Third-Party Integrations">
          <p>
            Moka integrates with Meta (Instagram, Facebook, Ads), YouTube (Google), and AI providers (OpenAI, Anthropic). Your use of these integrations is subject to their respective terms and privacy policies. Moka is not responsible for changes, outages, or policy changes from third-party providers.
          </p>
          <p>
            You represent that you have the right to grant Moka access to the social media accounts you connect. Revoking OAuth access from the third-party platform will disconnect the integration on Moka.
          </p>
        </Section>

        <Section title="6. Data and Privacy">
          <p>
            Your use of the Service is also governed by our{" "}
            <a href="/privacy" className="text-violet-400 underline underline-offset-4">Privacy Policy</a>, which describes the data we collect, how we store it, and your rights. By using the Service, you consent to the data practices described there.
          </p>
          <p>
            You retain ownership of all content and data you import into Moka. You grant Moka a limited license to store, process, and display that data solely to provide the Service to you.
          </p>
        </Section>

        <Section title="7. Subscription, Fees, and Cancellation">
          <p>
            Certain features may require a paid subscription. Pricing and billing terms are communicated at purchase. You can cancel your subscription at any time; cancellation takes effect at the end of the current billing period. We do not provide refunds for unused portions of a billing period except as required by law.
          </p>
        </Section>

        <Section title="8. Intellectual Property">
          <p>
            Moka, including its software, design, trademarks, and documentation, is the property of Summit Lab and is protected by copyright, trademark, and other intellectual property laws. These Terms do not transfer any ownership rights to you.
          </p>
          <p>
            AI-generated insights produced within the Service are provided to you under a non-exclusive license for your internal business use.
          </p>
        </Section>

        <Section title="9. Warranties and Disclaimers">
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING FITNESS FOR A PARTICULAR PURPOSE, MERCHANTABILITY, OR NON-INFRINGEMENT.
          </p>
          <p>
            AI-generated insights are informational only and should not be treated as professional advice. You are responsible for the business decisions you make based on the Service&apos;s output. Metric accuracy depends on third-party APIs; we do not guarantee real-time or 100% correct data.
          </p>
        </Section>

        <Section title="10. Limitation of Liability">
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, SUMMIT LAB AND MOKA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
          </p>
          <p>
            OUR TOTAL LIABILITY FOR ANY CLAIM SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) USD 100.
          </p>
        </Section>

        <Section title="11. Indemnification">
          <p>
            You agree to indemnify and hold Summit Lab harmless from any claims, damages, or expenses arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights.
          </p>
        </Section>

        <Section title="12. Termination">
          <p>
            We may suspend or terminate your access to the Service at any time, with or without notice, for violation of these Terms or for any other reason. Upon termination, your right to use the Service ceases immediately. You may request deletion of your data as described in the{" "}
            <a href="/privacy" className="text-violet-400 underline underline-offset-4">Privacy Policy</a> or at <a href="/data-deletion" className="text-violet-400 underline underline-offset-4">/data-deletion</a>.
          </p>
        </Section>

        <Section title="13. Changes to These Terms">
          <p>
            We may update these Terms from time to time. Material changes will be notified via email or in-product notice. Your continued use of the Service after changes become effective constitutes acceptance of the revised Terms.
          </p>
        </Section>

        <Section title="14. Governing Law">
          <p>
            These Terms are governed by the laws of Argentina, without regard to conflict of law principles. Any dispute arising under these Terms shall be resolved in the courts of the City of Buenos Aires, Argentina, unless otherwise required by mandatory law.
          </p>
        </Section>

        <Section title="15. Contact">
          <p>
            Questions about these Terms can be directed to:
          </p>
          <ul className="list-none space-y-1">
            <li>
              Email:{" "}
              <a href="mailto:support@usemoka.io" className="text-violet-400 underline underline-offset-4">
                support@usemoka.io
              </a>
            </li>
            <li>Company: Summit Lab</li>
          </ul>
        </Section>
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
          <a href="/data-deletion" className="hover:text-white/70 transition-colors">
            Data Deletion
          </a>
        </div>
      </footer>
    </main>
  );
}
