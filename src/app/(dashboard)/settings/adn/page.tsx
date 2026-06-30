import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getAdnData, getAdnProgress } from "@/services/adn-progress.service";
import { AdnEditor } from "@/components/settings/AdnEditor";
import { getServerTier } from "@/lib/tier/server";
import { TRAP } from "@/lib/tier/config";
import { FeatureLock } from "@/components/common/FeatureLock";

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

  // Demo: el ADN no aplica (no usa Moka AI).
  const tier = await getServerTier();
  if (tier === "demo") {
    return (
      <FeatureLock variant="page" preview="chat" title={TRAP.title} description={TRAP.description} ctaText={TRAP.ctaText} ctaHref={TRAP.ctaHref} />
    );
  }

  const [adnData, progress] = await Promise.all([
    getAdnData(supabase, workspaceId),
    getAdnProgress(supabase, workspaceId),
  ]);
  const t = await getTranslations("settingsAdn");

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className={`h-2 w-2 rounded-full ${progress.overall_complete ? "bg-emerald-400" : "bg-amber-400"}`} />
          <span className="text-[12px] text-white/40">
            {progress.overall_complete ? t("complete") : t("inProgress")}
          </span>
        </div>
      </div>

      <AdnEditor adnData={adnData} workspaceId={workspaceId} />
    </div>
  );
}
