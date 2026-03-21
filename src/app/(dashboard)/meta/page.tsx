import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MetaExplorerClient } from "@/components/meta/MetaExplorerClient";

export default async function MetaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id);

  if (!workspaces || workspaces.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-16 text-center">
        <p className="text-sm text-zinc-400">No se encontró workspace para tu usuario.</p>
      </div>
    );
  }

  const workspaceIds = workspaces.map((workspace) => workspace.id);

  const { data: connection } = await supabase
    .from("meta_connections")
    .select("workspace_id, ig_business_account_id, ig_username, fb_user_id, page_id, page_name")
    .in("workspace_id", workspaceIds)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!connection) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white">Meta API Explorer</h1>
        <p className="text-sm text-zinc-400">No hay conexión de Meta activa para tus workspaces.</p>
      </div>
    );
  }

  const { data: recentMedia } = await supabase
    .from("reels")
    .select("ig_media_id, caption, published_at")
    .eq("workspace_id", connection.workspace_id)
    .not("ig_media_id", "is", null)
    .order("published_at", { ascending: false })
    .limit(2);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <MetaExplorerClient
        workspaceId={connection.workspace_id}
        initialConnection={{
          ig_business_account_id: connection.ig_business_account_id,
          ig_username: connection.ig_username,
          fb_user_id: connection.fb_user_id,
          page_id: connection.page_id,
          page_name: connection.page_name,
        }}
        recentMedia={(recentMedia ?? []).map((item) => ({
          mediaId: item.ig_media_id,
          caption: item.caption ?? "",
          publishedAt: item.published_at ?? null,
        }))}
      />
    </div>
  );
}
