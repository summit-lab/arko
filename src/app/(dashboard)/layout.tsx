import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { NavProgressBar } from "@/components/layout/NavigationProvider";
import { AdnAlertBanner } from "@/components/features/onboarding/AdnAlertBanner";
import { Suspense } from "react";
import { cookies } from "next/headers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get("arko_user_role")?.value === "admin";
  const onboardingCompleted = cookieStore.get("arko_onboarding_completed")?.value === "true";
  const showAdnAlert = !onboardingCompleted && !isAdmin;
  return (
    <div className="flex min-h-screen">
      {/* ── Crossing & Fading Divider Lines ── */}
      {/* Vertical Line */}
      <div
        className="fixed left-[260px] top-0 bottom-0 w-[1px] z-50 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, rgba(255,255,255,0) 0px, rgba(255,255,255,0.2) 80px, rgba(255,255,255,0.03) 400px, rgba(255,255,255,0) 100%)",
        }}
      />
      {/* Horizontal Line */}
      <div
        className="fixed left-0 right-0 top-[80px] h-[1px] z-50 pointer-events-none"
        style={{
          background: "linear-gradient(to right, rgba(255,255,255,0) 0px, rgba(255,255,255,0.2) 260px, rgba(255,255,255,0.03) 800px, rgba(255,255,255,0) 100%)",
        }}
      />
      {/* Intersection Glow */}
      <div
        className="fixed left-[260px] top-[80px] w-4 h-4 -ml-2 -mt-2 rounded-full z-50 pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)",
        }}
      />

      <Suspense fallback={null}>
        <NavProgressBar />
      </Suspense>
      <Sidebar isAdmin={isAdmin} adnPending={!onboardingCompleted && !isAdmin} />
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
