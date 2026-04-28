"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

interface ReelAutoTitleProps {
  reelId: string;
  autoTitle: string | null;
  workspaceId: string | null;
}

export function ReelAutoTitle({ reelId, autoTitle, workspaceId }: ReelAutoTitleProps) {
  const t = useTranslations("igAdvanced");
  const [title, setTitle] = useState<string | null>(autoTitle);
  const [generating, setGenerating] = useState(!autoTitle && !!workspaceId);

  useEffect(() => {
    if (autoTitle || !workspaceId) return;

    const url = `/api/v1/reels/${reelId}/generate-title?workspace_id=${workspaceId}`;
    fetch(url, { method: "POST" })
      .then((r) => r.json())
      .then((data: { data?: { auto_title?: string } }) => {
        if (data?.data?.auto_title) setTitle(data.data.auto_title);
      })
      .catch(() => {})
      .finally(() => setGenerating(false));
  }, [reelId, autoTitle, workspaceId]);

  if (generating) {
    return (
      <p className="text-[18px] font-medium mb-2 leading-snug text-muted-foreground italic">
        {t("autoTitle.generating")}
      </p>
    );
  }

  return (
    <p className="text-[18px] font-medium text-foreground mb-2 leading-snug">
      {title ?? "—"}
    </p>
  );
}
