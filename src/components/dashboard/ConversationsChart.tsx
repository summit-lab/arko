"use client";

import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslations } from "next-intl";
import { useChartTheme } from "@/hooks/useChartTheme";

// Deterministic number formatter — bypasses the user-browser locale so SSR
// and client output stay identical. Default Node locale (en-US) and browser
// default (es-AR) disagreed on the thousand separator (comma vs dot) which
// caused a hydration mismatch.
const fmtNumber = (n: number) => n.toLocaleString("en-US");

interface DailyPoint {
  date: string;
  interactions: number;
}

interface Props {
  data: DailyPoint[];
  previousTotal?: number;
}

interface Delta {
  label: string;
  positive: boolean;
  neutral: boolean;
}

function computeDelta(currentTotal: number, previousTotal: number): Delta | null {
  if (previousTotal === 0 && currentTotal === 0) {
    return { label: "0%", positive: true, neutral: true };
  }
  if (previousTotal === 0) {
    return { label: `+${currentTotal}`, positive: true, neutral: false };
  }
  const pct = ((currentTotal - previousTotal) / previousTotal) * 100;
  return {
    label: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`,
    positive: pct >= 0,
    neutral: false,
  };
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DailyPoint }>;
}) {
  const t = useTranslations("igShell");
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-xl backdrop-blur-xl">
      <p className="text-[10px] text-muted-foreground font-medium">{d.date}</p>
      <p className="text-[13px] font-light">
        {fmtNumber(d.interactions)}{" "}
        <span className="text-[10px] text-muted-foreground">{t("conversations.interactions")}</span>
      </p>
    </div>
  );
}

export function ConversationsChart({ data, previousTotal = 0 }: Props) {
  const t = useTranslations("igShell");
  const chart = useChartTheme();
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-6">
        <h3 className="text-[15px] font-light tracking-wide text-white">
          {t("conversations.title")}
        </h3>
        <div className="flex h-[160px] items-center justify-center">
          <p className="text-[13px] font-light text-white/30">{t("conversations.noData")}</p>
        </div>
      </div>
    );
  }

  const total = sorted.reduce((s, p) => s + p.interactions, 0);
  const delta = computeDelta(total, previousTotal);

  return (
    <div className="glass-panel rounded-xl p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-light tracking-wide text-white">
          {t("conversations.title")}
        </h3>
        <div className="flex items-baseline gap-3">
          <span className="text-[22px] font-light tracking-[-0.02em] text-white">
            {fmtNumber(total)}
          </span>
          {delta && (
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-light ${
                delta.neutral
                  ? "bg-white/5 text-white/50"
                  : delta.positive
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-rose-500/15 text-rose-400"
              }`}
            >
              {delta.label}
            </span>
          )}
        </div>
      </div>
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sorted} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="convoGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7A86E0" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#7A86E0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: chart.axisTickSubtle, fontSize: 9 }}
              interval="preserveStartEnd"
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: chart.grid }} />
            <Area
              type="monotone"
              dataKey="interactions"
              stroke="#7A86E0"
              strokeWidth={1.5}
              fill="url(#convoGrad)"
              baseValue={0}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
