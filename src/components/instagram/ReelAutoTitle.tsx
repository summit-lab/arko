"use client";

import { useState, useEffect } from "react";

interface ReelAutoTitleProps {
  reelId: string;
  autoTitle: string | null;
}

export function ReelAutoTitle({ reelId, autoTitle }: ReelAutoTitleProps) {
  const [title, setTitle] = useState<string | null>(autoTitle);
  const [generating, setGenerating] = useState(!autoTitle);

  useEffect(() => {
    if (autoTitle) return;

    fetch(`/api/v1/reels/${reelId}/generate-title`, { method: "POST" })
      .then((r) => r.json())
      .then((data: { data?: { auto_title?: string } }) => {
        if (data?.data?.auto_title) setTitle(data.data.auto_title);
      })
      .catch(() => {})
      .finally(() => setGenerating(false));
  }, [reelId, autoTitle]);

  if (generating) {
    return (
      <p className="text-[18px] font-medium mb-2 leading-snug text-white/30 italic">
        Generando título…
      </p>
    );
  }

  return (
    <p className="text-[18px] font-medium text-white mb-2 leading-snug">
      {title ?? "—"}
    </p>
  );
}
