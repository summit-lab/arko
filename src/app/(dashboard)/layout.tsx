import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { NavProgressBar } from "@/components/layout/NavigationProvider";
import { AdnAlertBanner } from "@/components/features/onboarding/AdnAlertBanner";
import { NewSaleFAB } from "@/components/sales/NewSaleFAB";
import type { ReelPicker, StoryPicker } from "@/components/sales/SaleForm";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get("arko_user_role")?.value === "admin";
  // Cookie is an optimization; DB is the source of truth. Cookie can be stale
  // right after the user completes the ADN (middleware sets it on the response,
  // but the layout reads incoming cookies on the same request).
  let onboardingCompleted = cookieStore.get("arko_onboarding_completed")?.value === "true";

  // Fetch workspace branding + onboarding status + FAB pickers data.
  const workspaceId = cookieStore.get("arko_workspace_id")?.value;
  let brandName: string | null = null;
  let logoUrl: string | null = null;
  let reelsForPicker: ReelPicker[] = [];
  let storiesForPicker: StoryPicker[] = [];
  if (workspaceId) {
    const supabase = await createClient();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const [wsResult, reelsResult, storiesResult] = await Promise.all([
      supabase
        .from("workspaces")
        .select("name, settings, onboarding_completed")
        .eq("id", workspaceId)
        .single(),
      supabase
        .from("reels")
        .select("id, caption, thumbnail_url, published_at")
        .eq("workspace_id", workspaceId)
        .gte("published_at", ninetyDaysAgo)
        .order("published_at", { ascending: false })
        .limit(100),
      supabase
        .from("ig_story_sequences")
        .select(`
          id, published_at, total_impressions, total_reach,
          ig_story_slides (thumbnail_url, slide_index)
        `)
        .eq("workspace_id", workspaceId)
        .gte("published_at", ninetyDaysAgo)
        .order("published_at", { ascending: false })
        .limit(60),
    ]);

    if (wsResult.data) {
      const settings = wsResult.data.settings as Record<string, unknown>;
      brandName = (settings?.brand_name as string) || wsResult.data.name || null;
      logoUrl = (settings?.logo_url as string) || null;
      if (wsResult.data.onboarding_completed === true) {
        onboardingCompleted = true;
      }
    }
    if (reelsResult.data) reelsForPicker = reelsResult.data;
    if (storiesResult.data) {
      storiesForPicker = (storiesResult.data as Array<{
        id: string; published_at: string; total_impressions: number; total_reach: number;
        ig_story_slides: Array<{ thumbnail_url: string | null; slide_index: number }>;
      }>).map((seq) => {
        const slides = Array.isArray(seq.ig_story_slides) ? seq.ig_story_slides : [];
        const first = [...slides].sort((a, b) => a.slide_index - b.slide_index)[0];
        return {
          id: seq.id,
          published_at: seq.published_at,
          total_impressions: seq.total_impressions,
          total_reach: seq.total_reach,
          slide_count: slides.length,
          first_thumbnail: first?.thumbnail_url ?? null,
        };
      });
    }
  }

  const showAdnAlert = !onboardingCompleted && !isAdmin;

  return (
    <div className="flex min-h-screen">
      {/* ── Crossing & Fading Divider Lines ── */}
      {/* Vertical Line */}
      <div
        className="fixed left-[260px] top-0 bottom-0 w-[1px] z-50 pointer-events-none divider-vertical"
      />
      {/* Horizontal Line */}
      <div
        className="fixed left-0 right-0 top-[80px] h-[1px] z-50 pointer-events-none divider-horizontal"
      />
      {/* Intersection Glow */}
      <div
        className="fixed left-[260px] top-[80px] w-4 h-4 -ml-2 -mt-2 rounded-full z-50 pointer-events-none divider-glow"
      />

      <Suspense fallback={null}>
        <NavProgressBar />
      </Suspense>
      <Sidebar isAdmin={isAdmin} adnPending={!onboardingCompleted && !isAdmin} brandName={brandName} logoUrl={logoUrl} />
      <div className="flex-1 flex flex-col pl-[260px]">
        <Suspense fallback={
          <div className="h-[80px] w-full shrink-0" />
        }>
          <Header />
        </Suspense>
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {showAdnAlert && <AdnAlertBanner />}
          {children}
        </main>
      </div>

      {/* Floating "Nueva venta" CTA — any non-admin user can register a sale
          (source_type='otro' doesn't require a connected social account,
          and YT-only workspaces need this too). */}
      {!isAdmin && (
        <NewSaleFAB reels={reelsForPicker} stories={storiesForPicker} />
      )}
    </div>
  );
}
