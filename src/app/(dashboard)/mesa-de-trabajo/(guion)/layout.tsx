import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { ScriptLayoutShell } from "@/components/features/mesa-de-trabajo/ScriptLayoutShell";
import type { SidebarSibling } from "@/components/features/mesa-de-trabajo/ScriptSidebar";

// This layout lives in the (guion) route group, OUTSIDE the dynamic [id]
// segment. Next 15 treats it as a stable layout that persists across script
// navigations — same behavior as the global dashboard sidebar.
export default async function GuionLayout({ children }: { children: React.ReactNode }) {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return <>{children}</>;

  const cookieStore = await cookies();
  const workspaceIdCookie = cookieStore.get("arko_workspace_id")?.value ?? workspaceId;
  const supabase = await createClient();

  const { data: siblingsRaw } = await supabase
    .from("content_plan")
    .select("id, title, status, content_type, planned_date, script, updated_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  const siblings: SidebarSibling[] = (siblingsRaw ?? []).filter((s) => {
    const script = (s as { script?: string | null }).script;
    return typeof script === "string" && script.trim().length > 0;
  }) as SidebarSibling[];

  return (
    <ScriptLayoutShell siblings={siblings} workspaceId={workspaceIdCookie}>
      {children}
    </ScriptLayoutShell>
  );
}
