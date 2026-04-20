import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Moka",
  description: "Privacy Policy for Moka, the AI Marketing Director platform.",
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

export default function PrivacyPolicyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-white/40">
            Last updated: April 20, 2026
          </p>
        </div>

        <div className="h-px bg-white/[0.06]" />

        <Section title="1. Introduction">
          <p>
            Moka (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is a SaaS analytics platform developed
            by Summit Lab that provides AI-powered marketing intelligence for
            content creators and personal brands. This Privacy Policy describes
            how we collect, use, store, and protect your information when you use
            our platform at www.usearko.io (the &quot;Service&quot;).
          </p>
          <p>
            By using Moka, you consent to the data practices described in this
            policy. If you do not agree, please do not use the Service.
          </p>
        </Section>

        <Section title="2. Information We Collect">
          <p><strong className="text-white/80">Account Information:</strong> When you register or are invited to Moka, we collect your email address, name, and authentication credentials managed through Supabase Auth.</p>
          <p><strong className="text-white/80">Instagram Data:</strong> When you connect your Instagram Business Account via Meta OAuth, we access and store:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Profile information (username, name, follower count, following count, media count, biography, profile picture URL)</li>
            <li>Media data (Reels, Posts, Carousels — captions, media type, timestamps, thumbnail URLs)</li>
            <li>Engagement metrics (views, reach, impressions, likes, comments, shares, saves)</li>
            <li>Account-level insights (daily reach, follower growth, profile views, accounts engaged)</li>
            <li>Audience demographics (age-gender distribution, top cities, top countries)</li>
            <li>Comments on your media (for sentiment analysis purposes)</li>
          </ul>
          <p><strong className="text-white/80">Facebook Page Data:</strong> We access your Facebook Pages list solely to identify the Instagram Business Account linked to your Page. We read basic Page information (name, follower count).</p>
          <p><strong className="text-white/80">Meta Ads Data:</strong> When you connect your ad accounts, we access:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Ad account information (name, status, currency)</li>
            <li>Campaign, ad set, and ad performance metrics (impressions, clicks, spend, CPC, CPM)</li>
            <li>Ad creative metadata</li>
          </ul>
          <p><strong className="text-white/80">Business Management Data:</strong> We access your Meta Business accounts to identify connected assets (Pages, Instagram accounts, ad accounts).</p>
          <p><strong className="text-white/80">Usage Data:</strong> We collect standard web analytics data including page views, feature usage patterns, and session information to improve the Service.</p>
        </Section>

        <Section title="3. How We Use Your Data">
          <p>We use the collected data exclusively for the following purposes:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li><strong className="text-white/80">Analytics Dashboards:</strong> Displaying your Instagram, YouTube, and Ads performance metrics in visual dashboards within your private workspace</li>
            <li><strong className="text-white/80">AI-Powered Insights:</strong> Generating marketing insights, content analysis, and recommendations using AI models based on your real performance data</li>
            <li><strong className="text-white/80">Trend Analysis:</strong> Tracking metric changes over time (7-day, 30-day, 90-day periods) to identify growth patterns and content performance trends</li>
            <li><strong className="text-white/80">Content Optimization:</strong> Analyzing which content types, formats, and topics drive the most engagement and growth for your specific audience</li>
            <li><strong className="text-white/80">Competitor Analysis:</strong> Comparing your metrics against industry benchmarks (using only your own data)</li>
          </ul>
          <p>
            <strong className="text-white/80">We do NOT:</strong>
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Sell your data to third parties</li>
            <li>Share your data with other users or workspaces</li>
            <li>Use your data for advertising purposes</li>
            <li>Post content on your behalf</li>
            <li>Modify, create, or delete your ads, posts, or any content</li>
            <li>Read, display, or store the content of your direct messages</li>
            <li>Store your Meta/Facebook login credentials</li>
          </ul>
        </Section>

        <Section title="3.1 Instagram Direct Message tracking (optional)">
          <p>
            When you enable <strong className="text-white/80">DM tracking</strong> in{" "}
            <em>Settings → Integrations</em>, Moka receives a notification from Instagram each time your business account gets a direct message. We use this data for one purpose only: to show you how many new conversations you receive per day on your dashboard.
          </p>
          <p><strong className="text-white/80">What we store:</strong></p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Message timestamp</li>
            <li>Opaque thread ID (provided by Meta)</li>
            <li>Opaque sender ID (provided by Meta)</li>
            <li>Event type (message or reaction)</li>
          </ul>
          <p><strong className="text-white/80">What we do NOT store:</strong></p>
          <ul className="list-disc space-y-1 pl-6">
            <li>The message text</li>
            <li>Images, videos, audio, or attachments</li>
            <li>The sender&apos;s name, username, email, or phone</li>
            <li>Any preview of the message content</li>
          </ul>
          <p>
            Moka has no inbox. You cannot read or reply to messages from Moka. We do not sell this data, share it with third parties, or send it to AI models.
          </p>
          <p><strong className="text-white/80">Retention:</strong> Raw events are kept for 90 days and then automatically deleted. Daily aggregates (date + count) are kept while your workspace is active.</p>
          <p><strong className="text-white/80">How to delete DM data:</strong> go to <em>Settings → Integrations</em> and click <strong className="text-white/80">Delete DM data</strong>, or turn off the DM tracking toggle (this unsubscribes the webhook and purges stored data). You can also revoke access from{" "}
            <a href="https://www.facebook.com/settings?tab=business_tools" className="text-violet-400 underline underline-offset-4" target="_blank" rel="noopener noreferrer">Facebook Settings → Business Integrations</a>, or request full account deletion by emailing <a href="mailto:support@usearko.io" className="text-violet-400 underline underline-offset-4">support@usearko.io</a>. Moka also honors Meta&apos;s Data Deletion Callback: if you request deletion from Meta&apos;s dashboard, your DM data is purged automatically.
          </p>
        </Section>

        <Section title="4. Data Storage and Security">
          <p><strong className="text-white/80">Infrastructure:</strong> Your data is stored on Supabase (PostgreSQL on AWS infrastructure) with data centers located in the United States.</p>
          <p><strong className="text-white/80">Encryption at Rest:</strong> All Meta OAuth access tokens are encrypted using AES-256 encryption via PostgreSQL&apos;s pgcrypto extension (pgp_sym_encrypt). Tokens are never stored in plaintext.</p>
          <p><strong className="text-white/80">Encryption in Transit:</strong> All data transmitted between your browser and our servers, and between our servers and third-party APIs, is encrypted using TLS 1.2+.</p>
          <p><strong className="text-white/80">Workspace Isolation:</strong> Every workspace is completely isolated through PostgreSQL Row-Level Security (RLS) policies. Users can only access data belonging to their own workspace. This isolation is enforced at the database level.</p>
          <p><strong className="text-white/80">Authentication:</strong> User authentication is managed by Supabase Auth with secure session management. We support email/password authentication and invite-based onboarding.</p>
          <p><strong className="text-white/80">Environment Separation:</strong> We maintain separate development and production environments with independent databases. Development data never mixes with production data.</p>
        </Section>

        <Section title="5. Third-Party Services">
          <p>We integrate with the following third-party services:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li><strong className="text-white/80">Meta Platforms (Facebook/Instagram):</strong> For OAuth authentication and accessing Instagram and Ads data via the Meta Graph API</li>
            <li><strong className="text-white/80">Supabase:</strong> For database hosting, authentication, and Edge Functions</li>
            <li><strong className="text-white/80">Vercel:</strong> For application hosting and deployment</li>
            <li><strong className="text-white/80">OpenAI:</strong> For AI-powered analysis and content insights (we send anonymized metric data, not personal information)</li>
            <li><strong className="text-white/80">Anthropic:</strong> For AI conversational agents (same data handling as OpenAI)</li>
          </ul>
          <p>Each third-party service has its own privacy policy governing their handling of data.</p>
        </Section>

        <Section title="6. Data Retention">
          <p>We retain your data for as long as your account is active. Specifically:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li><strong className="text-white/80">Account data:</strong> Retained until account deletion is requested</li>
            <li><strong className="text-white/80">Instagram/Ads metrics:</strong> Retained for historical trend analysis as long as the account is active</li>
            <li><strong className="text-white/80">OAuth tokens:</strong> Retained until the user disconnects their Meta account or the token expires (typically 60 days, after which re-authentication is required)</li>
            <li><strong className="text-white/80">Instagram DM events (raw):</strong> 90 days, then automatically deleted</li>
            <li><strong className="text-white/80">Instagram DM aggregates (daily counts):</strong> Retained while your workspace is active</li>
            <li><strong className="text-white/80">AI conversation history:</strong> Retained within the workspace for reference</li>
          </ul>
        </Section>

        <Section title="7. Your Rights and Choices">
          <p>You have the following rights regarding your data:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li><strong className="text-white/80">Disconnect:</strong> You can disconnect your Meta account at any time from your dashboard settings. This immediately nullifies all stored tokens.</li>
            <li><strong className="text-white/80">Data Access:</strong> You can request a copy of all data we store about you by contacting us.</li>
            <li><strong className="text-white/80">Data Deletion:</strong> You can request complete deletion of your account and all associated data. See our <a href="/data-deletion" className="text-violet-400 underline underline-offset-4">Data Deletion Policy</a>.</li>
            <li><strong className="text-white/80">Revoke Meta Permissions:</strong> You can revoke Moka&apos;s access to your Meta data at any time through your <a href="https://www.facebook.com/settings?tab=business_tools" className="text-violet-400 underline underline-offset-4" target="_blank" rel="noopener noreferrer">Facebook Settings &gt; Business Integrations</a>.</li>
          </ul>
        </Section>

        <Section title="8. Children's Privacy">
          <p>
            Moka is not intended for use by individuals under the age of 18. We
            do not knowingly collect personal information from children. If we
            become aware that we have collected data from a child under 18, we
            will delete that information immediately.
          </p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. We will notify
            registered users of material changes via email or through a notice
            in the Service. Your continued use of the Service after changes
            become effective constitutes acceptance of the revised policy.
          </p>
        </Section>

        <Section title="10. Contact Us">
          <p>
            If you have questions about this Privacy Policy or our data
            practices, please contact us at:
          </p>
          <ul className="list-none space-y-1">
            <li>
              Email:{" "}
              <a href="mailto:support@usearko.io" className="text-violet-400 underline underline-offset-4">
                support@usearko.io
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
          <a href="/data-deletion" className="hover:text-white/70 transition-colors">
            Data Deletion
          </a>
        </div>
      </footer>
    </main>
  );
}
