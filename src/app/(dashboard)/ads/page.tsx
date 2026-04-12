import { getWorkspaceId } from "@/lib/workspace";
import AdsClient from "./AdsClient";

export default async function AdsPage() {
  const workspaceId = await getWorkspaceId();

  if (!workspaceId) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <p className="text-white/30 text-[13px] font-light">No se encontró workspace.</p>
      </div>
    );
  }

  return <AdsClient workspaceId={workspaceId} />;
}
