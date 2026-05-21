"use client";

import { CalendarDays } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "@/components/layout/ThemeProvider";
import { CONTENT_STATUSES, CONTENT_TYPES } from "@/types/content-plan";
import type { ContentItem, ContentStatus, ContentType } from "@/types/content-plan";

interface ContentCardProps {
  item: ContentItem;
  onClick: () => void;
}

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(locale === "en" ? "en-US" : "es-AR", { day: "numeric", month: "short" });
}

export function ContentCard({ item, onClick }: ContentCardProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const t = useTranslations("mesaDeTrabajo");
  const locale = useLocale();

  const typeMeta   = CONTENT_TYPES.find((tp) => tp.value === item.content_type);
  const statusMeta = CONTENT_STATUSES.find((s) => s.value === item.status);
  const typeLabel   = typeMeta   ? t(`type.${typeMeta.value}` as `type.${ContentType}`)         : item.content_type;
  const statusLabel = statusMeta ? t(`status.${statusMeta.value}` as `status.${ContentStatus}`) : item.status;

  const cardBg      = isLight ? "rgba(255,255,255,0.80)" : "rgba(255,255,255,0.03)";
  const cardBorder  = isLight ? "rgba(17,17,17,0.08)"    : "rgba(255,255,255,0.07)";
  const cardHoverBg = isLight ? "rgba(255,255,255,1)"    : "rgba(255,255,255,0.06)";
  const cardHoverBorder = isLight ? "rgba(17,17,17,0.15)" : "rgba(255,255,255,0.12)";
  const textMain    = isLight ? "#111111" : "rgba(255,255,255,0.85)";
  const textSub     = isLight ? "rgba(17,17,17,0.45)" : "rgba(255,255,255,0.38)";

  const TYPE_ACCENT: Record<string, { border: string; shadow: string; shadowHover: string }> = {
    reel:          { border: "rgba(139,92,246,0.22)", shadow: "0 0 0 1px rgba(139,92,246,0.18), 0 4px 20px rgba(139,92,246,0.18)", shadowHover: "0 0 0 1px rgba(139,92,246,0.35), 0 4px 24px rgba(139,92,246,0.28)" },
    carousel:      { border: "rgba(14,165,233,0.22)",  shadow: "0 0 0 1px rgba(14,165,233,0.18),  0 4px 20px rgba(14,165,233,0.18)",  shadowHover: "0 0 0 1px rgba(14,165,233,0.35),  0 4px 24px rgba(14,165,233,0.28)"  },
    story:         { border: "rgba(251,146,60,0.22)",  shadow: "0 0 0 1px rgba(251,146,60,0.18),  0 4px 20px rgba(251,146,60,0.18)",  shadowHover: "0 0 0 1px rgba(251,146,60,0.35),  0 4px 24px rgba(251,146,60,0.28)"  },
    youtube_video: { border: "rgba(239,68,68,0.22)",   shadow: "0 0 0 1px rgba(239,68,68,0.18),   0 4px 20px rgba(239,68,68,0.18)",   shadowHover: "0 0 0 1px rgba(239,68,68,0.35),   0 4px 24px rgba(239,68,68,0.28)"   },
  };
  const accent = TYPE_ACCENT[item.content_type] ?? { border: cardBorder, shadow: "none", shadowHover: "none" };

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border transition-all duration-150 p-3 flex flex-col gap-2 group"
      style={{
        background: cardBg,
        borderColor: accent.border,
        boxShadow: accent.shadow,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = cardHoverBg;
        el.style.boxShadow = accent.shadowHover;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = cardBg;
        el.style.boxShadow = accent.shadow;
      }}
    >
      {/* Type + date row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium tracking-wide" style={{ color: textSub }}>
          {typeLabel}
        </span>
        {item.planned_date && (
          <span className="flex items-center gap-1 text-[11px]" style={{ color: textSub }}>
            <CalendarDays size={11} strokeWidth={1.5} />
            {formatDate(item.planned_date, locale)}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-[13px] font-medium leading-snug line-clamp-2" style={{ color: textMain }}>
        {item.title}
      </p>

      {/* Status */}
      <div className="flex items-center gap-1.5 mt-0.5">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: statusMeta?.dot ?? "rgba(150,150,150,0.5)" }}
        />
        <span className="text-[11px]" style={{ color: textSub }}>
          {statusLabel}
        </span>
      </div>
    </button>
  );
}
