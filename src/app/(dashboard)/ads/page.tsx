import { getTranslations } from "next-intl/server";
import { getWorkspaceId } from "@/lib/workspace";
import AdsClient from "./AdsClient";
import { getServerTier } from "@/lib/tier/server";
import { hasFeature, TRAP } from "@/lib/tier/config";
import { FeatureLock } from "@/components/common/FeatureLock";

export default async function AdsPage() {
  const tier = await getServerTier();
  if (!hasFeature(tier, "ads")) {
    return (
      <FeatureLock variant="page" preview="metrics" title={TRAP.title} description={TRAP.description} ctaText={TRAP.ctaText} ctaHref={TRAP.ctaHref} />
    );
  }
  const workspaceId = await getWorkspaceId();
  const t = await getTranslations("ads");

  if (!workspaceId) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground text-[13px] font-light">{t("noWorkspace")}</p>
      </div>
    );
  }

  return <AdsClient workspaceId={workspaceId} />;
}
