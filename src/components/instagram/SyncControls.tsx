"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { SyncButton } from "./SyncButton";
import { useNewContentPolling } from "@/hooks/useNewContentPolling";

interface SyncControlsProps {
  workspaceId: string;
  currentTab?: string;
}

/**
 * Combines sync button + auto-polling badge.
 * Shows a "N new" indicator when new content is detected.
 */
export function SyncControls({ workspaceId, currentTab }: SyncControlsProps) {
  const router = useRouter();
  const t = useTranslations("igAdvanced");
  const { hasNewContent, newCount, dismiss } = useNewContentPolling({
    workspaceId,
    intervalMs: 3 * 60 * 1000,
    enabled: true,
  });

  const handleNewContentClick = useCallback(() => {
    dismiss();
    router.refresh();
  }, [dismiss, router]);

  return (
    <div className="flex items-center gap-2">
      {hasNewContent && (
        <button
          onClick={handleNewContentClick}
          className="flex items-center gap-1.5 text-[12px] font-medium text-cyan-300 px-3 py-1.5 rounded-md transition-all cursor-pointer animate-pulse hover:bg-cyan-400/10"
          style={{ border: "1px solid rgba(34,211,238,0.2)", background: "rgba(34,211,238,0.05)" }}
        >
          <Bell size={12} strokeWidth={2} />
          {t("sync.newCount", { count: newCount })}
        </button>
      )}
      <SyncButton workspaceId={workspaceId} currentTab={currentTab} />
    </div>
  );
}
