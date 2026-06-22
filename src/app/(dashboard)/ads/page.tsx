import { getTranslations } from "next-intl/server";
import { getWorkspaceId } from "@/lib/workspace";
import AdsClient from "./AdsClient";

export default async function AdsPage() {
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
