import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { MetasEditor } from "./metas-editor";

export default async function MetasSettingsPage() {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) redirect("/login");

  const supabase = await createClient();
  const t = await getTranslations("settingsMetas");
  const locale = await getLocale();
  const dateLocale = locale === "en" ? "en-US" : "es-AR";

  const METRIC_LABELS: Record<string, string> = {
    views: t("metricLabels.views"),
    followers: t("metricLabels.followers"),
    engagement_rate: t("metricLabels.engagement_rate"),
    likes: t("metricLabels.likes"),
    saves: t("metricLabels.saves"),
    reach: t("metricLabels.reach"),
  };

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const { data: goals } = await supabase
    .from("workspace_goals")
    .select("metric, target_value")
    .eq("workspace_id", workspaceId)
    .eq("period_start", periodStart);

  const goalsMap: Record<string, number> = {};
  for (const g of (goals ?? []) as { metric: string; target_value: number }[]) {
    goalsMap[g.metric] = Number(g.target_value);
  }

  const monthLabel = now.toLocaleDateString(dateLocale, { month: "long", year: "numeric" });

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("subtitle", { month: monthLabel })}
        </p>
      </div>

      <MetasEditor goals={goalsMap} metricLabels={METRIC_LABELS} />
    </div>
  );
}
