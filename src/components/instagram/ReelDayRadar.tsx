"use client";

import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, Tooltip,
} from "recharts";
import { useTranslations, useLocale } from "next-intl";
import { useChartTheme } from "@/hooks/useChartTheme";

interface DayData {
  day: string;
  views: number;
}

function RadarTooltip({ active, payload, locale }: { active?: boolean; payload?: Array<{ value: number }>; locale: string }) {
  const t = useTranslations("igGrids");
  if (!active || !payload?.length) return null;
  const numLocale = locale === "en" ? "en-US" : "es-AR";
  return (
    <div className="rounded-lg border border-border bg-popover text-popover-foreground px-2.5 py-1.5 text-[11px] pointer-events-none backdrop-blur-xl shadow-xl">
      <p className="text-popover-foreground">{payload[0].value.toLocaleString(numLocale)} {t("dayRadar.views")}</p>
    </div>
  );
}

export function ReelDayRadar({ data }: { data: DayData[] }) {
  const chart = useChartTheme();
  const t = useTranslations("igGrids");
  const locale = useLocale();
  const numLocale = locale === "en" ? "en-US" : "es-AR";
  const bestDay = data.reduce((max, d) => (d.views > max.views ? d : max), data[0]);
  const hasData = data.some((d) => d.views > 0);

  if (!hasData) return null;

  return (
    <div>
      <p className="text-[10px] text-white/30 mb-0.5 uppercase tracking-[0.08em] font-medium">{t("dayRadar.title")}</p>
      <p className="text-[10px] text-white/20 mb-3">{t("dayRadar.subtitle")}</p>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
            <PolarGrid stroke={chart.grid} />
            <PolarAngleAxis
              dataKey="day"
              tick={{ fill: chart.axisTick, fontSize: 11 }}
            />
            <Radar
              name={t("dayRadar.viewsName")}
              dataKey="views"
              stroke="#7A86E0"
              fill="#7A86E0"
              fillOpacity={0.18}
              strokeWidth={2}
              animationDuration={1200}
            />
            <Tooltip content={<RadarTooltip locale={locale} />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div
        className="rounded-xl px-3 py-2.5 mt-2"
        style={{ background: "rgba(122,134,224,0.06)", border: "1px solid rgba(122,134,224,0.12)" }}
      >
        <p className="text-[9px] font-medium uppercase tracking-[0.08em] mb-0.5" style={{ color: "rgba(122,134,224,0.7)" }}>{t("dayRadar.bestDayLabel")}</p>
        <p className="text-[11px] text-white/50 font-light">
          <span className="text-white">{bestDay.day}</span>
          {" — "}<span style={{ color: "#7A86E0" }}>{bestDay.views.toLocaleString(numLocale)}</span> {t("dayRadar.views")}
        </p>
      </div>
    </div>
  );
}
