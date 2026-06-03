import { createClient } from "@/lib/supabase/server";
import { ReferencesTab } from "./ReferencesTab";

/**
 * Server Component async que carga referencias + sus analisis AI (dos queries en
 * cadena: workspace_references -> reference_reel_analysis) FUERA del critical path.
 * Antes el reference_reel_analysis era el tercer await SECUENCIAL del page (tras el
 * Promise.all y el firmado de historias), sumando su latencia full al primer paint
 * de una tab que ni siquiera es la default. Ahora streamea via <Suspense>.
 */
export async function ReferencesLoader({ workspaceId }: { workspaceId: string | null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let initialReferences: any[] = [];

  if (workspaceId) {
    const supabase = await createClient();
    const { data: refs } = await supabase
      .from("workspace_references")
      .select("id, brand_name, brand_url, what_they_like, created_at, scraped_data, scraped_reels, last_scraped_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (refs && refs.length > 0) {
      const refIds = refs.map((r) => r.id);
      const { data: analyses } = await supabase
        .from("reference_reel_analysis")
        .select("reference_id, reel_short_code, hook_text, hook_type, narrative_structure, content_type, cta_text, cta_type, topic_cluster, style_notes, strengths, weaknesses, ai_summary, model_used, analyzed_at")
        .in("reference_id", refIds);

      const analysesByRef = (analyses ?? []).reduce((acc, a) => {
        const list = acc.get(a.reference_id) ?? [];
        list.push(a);
        acc.set(a.reference_id, list);
        return acc;
      }, new Map<string, unknown[]>());

      initialReferences = refs.map((r) => ({
        ...r,
        reference_reel_analysis: analysesByRef.get(r.id) ?? [],
      }));
    }
  }

  return <ReferencesTab workspaceId={workspaceId} initialReferences={initialReferences} />;
}
