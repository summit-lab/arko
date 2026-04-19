import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdnData, getAdnProgress } from "@/services/adn-progress.service";
import { AdnEditor } from "@/components/settings/AdnEditor";

export const metadata = {
  title: "ADN de Marca | Moka",
};

export default async function AdnSettingsPage() {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("arko_workspace_id")?.value;
  if (!workspaceId) redirect("/login");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [adnData, progress] = await Promise.all([
    getAdnData(supabase, workspaceId),
    getAdnProgress(supabase, workspaceId),
  ]);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">ADN de Marca</h1>
          <p className="text-zinc-400 mt-1 text-sm">
            Tu perfil de comunicación y estrategia. Editá cada sección directamente.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className={`h-2 w-2 rounded-full ${progress.overall_complete ? "bg-emerald-400" : "bg-amber-400"}`} />
          <span className="text-[12px] text-white/40">
            {progress.overall_complete ? "Completo" : "En progreso"}
          </span>
        </div>
      </div>

      <AdnEditor adnData={adnData} workspaceId={workspaceId} />
    </div>
  );
}
