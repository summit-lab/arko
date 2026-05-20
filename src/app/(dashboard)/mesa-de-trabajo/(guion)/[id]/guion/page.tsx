import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { ScriptPage } from "@/components/features/mesa-de-trabajo/ScriptPage";
import type { ContentItem } from "@/types/content-plan";

const FULL_SELECT = "id, workspace_id, planned_date, title, description, platform, content_type, status, script, reference_url, raw_video_url, edited_video_url, source_type, source_ref, metrics, created_at, updated_at";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GuionPage({ params }: PageProps) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) return notFound();

  const cookieStore = await cookies();
  const workspaceIdCookie = cookieStore.get("arko_workspace_id")?.value ?? workspaceId;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("content_plan")
    .select(FULL_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();

  if (!item) return notFound();

  return (
    <ScriptPage
      item={item as ContentItem}
      workspaceId={workspaceIdCookie}
    />
  );
}
