import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { NavProgressBar } from "@/components/layout/NavigationProvider";
import { AdnAlertBanner } from "@/components/features/onboarding/AdnAlertBanner";
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

  // Fetch workspace branding + onboarding status.
  const workspaceId = cookieStore.get("arko_workspace_id")?.value;
  let brandName: string | null = null;
  let logoUrl: string | null = null;
  if (workspaceId) {
    const supabase = await createClient();
    const { data: wsData } = await supabase
      .from("workspaces")
      .select("name, settings, onboarding_completed")
      .eq("id", workspaceId)
      .single();

    if (wsData) {
      const settings = wsData.settings as Record<string, unknown>;
      brandName = (settings?.brand_name as string) || wsData.name || null;
      logoUrl = (settings?.logo_url as string) || null;
      if (wsData.onboarding_completed === true) {
        onboardingCompleted = true;
      }
    }
  }

  const showAdnAlert = !onboardingCompleted && !isAdmin;

  return (
    <div className="flex min-h-screen">
      {/* ── Crossing & Fading Divider Lines ── */}
      {/* z-[60] para que los dividers siempre ganen contra el topbar sticky
          (que esta en z-50). Antes el backdrop-blur del topbar los tapaba. */}
      {/* Vertical Line */}
      <div
        className="fixed left-[260px] top-0 bottom-0 w-[1px] z-[60] pointer-events-none divider-vertical"
      />
      {/* Horizontal Line */}
      <div
        className="fixed left-0 right-0 top-[80px] h-[1px] z-[60] pointer-events-none divider-horizontal"
      />
      {/* Intersection Glow */}
      <div
        className="fixed left-[260px] top-[80px] w-4 h-4 -ml-2 -mt-2 rounded-full z-[60] pointer-events-none divider-glow"
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
    </div>
  );
}
