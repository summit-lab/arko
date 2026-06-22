import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { MesaDeTrabajoShell } from "@/components/features/mesa-de-trabajo/MesaDeTrabajoShell";
import type { ContentItem, CalendarReel } from "@/types/content-plan";

const BASE_SELECT = "id, planned_date, title, description, platform, content_type, status, created_at, updated_at";
const FULL_SELECT = `${BASE_SELECT}, script, source_type, source_ref, metrics`;

export default async function MesaDeTrabajoPage() {
  const cookieStore = await cookies();
  const workspaceId = await getWorkspaceId();
  const workspaceIdCookie = cookieStore.get("arko_workspace_id")?.value ?? workspaceId ?? "";

  let items: ContentItem[]    = [];
  let publishedReels: CalendarReel[] = [];

  if (workspaceId) {
    const supabase = await createClient();

    // Content plan items — try full columns, fall back to base
    const full = await supabase
      .from("content_plan")
      .select(FULL_SELECT)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (!full.error && full.data) {
      items = full.data as ContentItem[];
    } else {
      const base = await supabase
        .from("content_plan")
        .select(BASE_SELECT)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (base.data) items = base.data as ContentItem[];
    }

    // Published Instagram reels + carousels for the calendar
    const { data: reelsData } = await supabase
      .from("reels")
      .select("id, caption, published_at, media_type")
      .eq("workspace_id", workspaceId)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(200);

    if (reelsData) {
      publishedReels = reelsData
        .filter((r) => r.published_at)
        .map((r) => ({
          id: r.id as string,
          date: (r.published_at as string).slice(0, 10),
          caption: ((r.caption as string | null) ?? "(Sin caption)").slice(0, 60),
          type: (r.media_type as string) === "CAROUSEL_ALBUM" ? "carousel" as const : "reel" as const,
          href: `/instagram/${r.id as string}`,
        }));
    }

    // Published story sequences for the calendar
    const { data: storiesData } = await supabase
      .from("ig_story_sequences")
      .select("id, published_at")
      .eq("workspace_id", workspaceId)
      .order("published_at", { ascending: false })
      .limit(100);

    if (storiesData) {
      const stories = storiesData
        .filter((s) => s.published_at)
        .map((s) => ({
          id: s.id as string,
          date: (s.published_at as string).slice(0, 10),
          caption: "Secuencia de historias",
          type: "story" as const,
          href: `/instagram`,
        }));
      publishedReels = [...publishedReels, ...stories];
    }
  }

  return (
    <MesaDeTrabajoShell
      initialItems={items}
      publishedReels={publishedReels}
      workspaceId={workspaceIdCookie}
    />
  );
}
