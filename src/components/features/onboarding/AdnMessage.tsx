"use client";

import { Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { AIMarkdown } from "@/components/ai/AIMarkdown";

interface AdnMessageProps {
  role: "user" | "assistant";
  content: string;
  onCompetitorFormClick?: () => void;
  competitorCount?: number;
}

const COMPETITOR_MARKER = "{{COMPETITOR_FORM}}";

export function AdnMessage({ role, content, onCompetitorFormClick, competitorCount }: AdnMessageProps) {
  const isUser = role === "user";
  const hasCompetitorForm = !isUser && content.includes(COMPETITOR_MARKER);

  // Split content around the marker
  const parts = hasCompetitorForm ? content.split(COMPETITOR_MARKER) : [content];

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-6 py-3.5 text-[13.5px] leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground dark:bg-white/[0.07] dark:border dark:border-white/[0.06] dark:text-white/75"
            : "glass-card text-foreground/70 dark:text-white/65"
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-2">
            <div className="h-4 w-4 rounded-full bg-foreground/10 dark:bg-gradient-to-b dark:from-white/12 dark:to-white/4 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/moka.svg"
                alt="Moka"
                width={9}
                height={9}
                style={{ width: 9, height: 9, objectFit: "contain" }}
              />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground dark:text-white/30 tracking-wide">Moka</span>
          </div>
        )}

        {isUser ? (
          <div className="whitespace-pre-wrap">{content}</div>
        ) : hasCompetitorForm ? (
          <div className="space-y-3">
            {/* Text before marker */}
            {parts[0] && parts[0].trim() && <AIMarkdown>{parts[0].trim()}</AIMarkdown>}

            {/* Competitor form card */}
            <CompetitorFormCard
              onClick={onCompetitorFormClick}
              competitorCount={competitorCount ?? 0}
            />

            {/* Text after marker */}
            {parts[1] && parts[1].trim() && <AIMarkdown>{parts[1].trim()}</AIMarkdown>}
          </div>
        ) : (
          <AIMarkdown>{content}</AIMarkdown>
        )}
      </div>
    </div>
  );
}

function CompetitorFormCard({
  onClick,
  competitorCount,
}: {
  onClick?: () => void;
  competitorCount: number;
}) {
  const t = useTranslations("onboarding.competitorCard");
  const hasSaved = competitorCount > 0;

  return (
    <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.04] p-4 my-2">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
          <Users size={16} className="text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-light text-white/70">
            {hasSaved
              ? t("savedCount", { count: competitorCount })
              : t("emptyTitle")}
          </p>
          <p className="text-[11px] text-white/30 font-light mt-0.5">
            {hasSaved
              ? t("savedHint")
              : t("emptyHint")}
          </p>
        </div>
        <button
          onClick={onClick}
          className="shrink-0 px-4 py-2 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-[12px] font-medium text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-violet-200 transition-all cursor-pointer"
        >
          {hasSaved ? t("edit") : t("add")}
        </button>
      </div>
    </div>
  );
}
