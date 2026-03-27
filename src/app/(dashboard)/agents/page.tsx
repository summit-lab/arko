import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import ArkoAIClient from "./AgentsClient";

export default async function ArkoAIPage() {
  const cookieStore = await cookies();
  const adnComplete =
    cookieStore.get("arko_onboarding_completed")?.value === "true";
  const workspaceId = cookieStore.get("arko_workspace_id")?.value;

  let sessions: Array<{
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
  }> = [];

  if (workspaceId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("chat_sessions")
      .select("id, title, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .neq("title", "ADN de Comunicación")
      .order("updated_at", { ascending: false })
      .limit(50);

    sessions = data ?? [];
  }

  return (
    <ArkoAIClient
      adnComplete={adnComplete}
      initialSessions={sessions}
      workspaceId={workspaceId ?? ""}
    />
  );
}
