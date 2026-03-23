import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { InitialInstagramSyncScreen } from "@/components/instagram/InitialInstagramSyncScreen";

export default async function InstagramBootstrapPage() {
  const workspaceId = await getWorkspaceId();

  if (!workspaceId) {
    redirect("/onboarding");
  }

  const supabase = await createClient();
  const { data: connection } = await supabase
    .from("meta_connections")
    .select("status, ig_username")
    .eq("workspace_id", workspaceId)
    .single();

  if (connection?.status !== "active") {
    redirect("/onboarding");
  }

  return <InitialInstagramSyncScreen workspaceId={workspaceId} igUsername={connection.ig_username || null} />;
}
