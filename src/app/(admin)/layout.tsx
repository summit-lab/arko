import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth-claims";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { NavProgressBar } from "@/components/layout/NavigationProvider";
import { Suspense } from "react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Double-check admin role (middleware already checks, this is defense-in-depth)
  const supabase = await createClient();
  const user = await getAuthUser(supabase); // getClaims (JWT local) + fallback getUser

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

  return (
    <div className="flex min-h-screen">
      {/* Vertical divider */}
      <div
        className="fixed left-[220px] top-0 bottom-0 w-[1px] z-50 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, rgba(255,255,255,0) 0px, rgba(251,191,36,0.3) 80px, rgba(255,255,255,0.03) 400px, rgba(255,255,255,0) 100%)",
        }}
      />

      <Suspense fallback={null}>
        <NavProgressBar />
      </Suspense>
      <AdminSidebar />
      <div className="flex-1 flex flex-col pl-[220px]">
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
