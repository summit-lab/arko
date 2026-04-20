"use client";

import Link from "next/link";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useChartTheme } from "@/hooks/useChartTheme";

interface DailyPoint {
  date: string;
  new_conversations: number;
}

interface Props {
  data: DailyPoint[];
}

interface Delta {
  label: string;
  positive: boolean;
  neutral: boolean;
}

function computeWoWDelta(data: DailyPoint[]): Delta | null {
  if (data.length < 14) return null;
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const last14 = sorted.slice(-14);
  const prev7 = last14.slice(0, 7).reduce((s, p) => s + p.new_conversations, 0);
  const curr7 = last14.slice(7).reduce((s, p) => s + p.new_conversations, 0);

  if (prev7 === 0 && curr7 === 0) {
    return { label: "0%", positive: true, neutral: true };
  }
  if (prev7 === 0) {
    return { label: `+${curr7}`, positive: true, neutral: false };
  }
  const pct = ((curr7 - prev7) / prev7) * 100;
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
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-xl backdrop-blur-xl">
      <p className="text-[10px] text-muted-foreground font-medium">{d.date}</p>
      <p className="text-[13px] font-light">
        {d.new_conversations.toLocaleString()}{" "}
        <span className="text-[10px] text-muted-foreground">nuevas convos</span>
      </p>
    </div>
  );
}

export function ConversationsChart({ data }: Props) {
  const chart = useChartTheme();
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const last14 = sorted.slice(-14);
  const delta = computeWoWDelta(sorted);

  if (last14.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-light tracking-wide text-white">
            Conversaciones nuevas
          </h3>
        </div>
        <div className="flex h-[160px] flex-col items-center justify-center gap-2">
          <p className="text-[13px] font-light text-white/30">Sin datos todav&iacute;a</p>
          <Link
            href="/settings/integrations"
            className="text-[11px] font-light text-[#7A86E0] underline-offset-2 hover:underline"
          >
            Activ&aacute; el webhook en settings
          </Link>
        </div>
      </div>
    );
  }

  const total14 = last14.reduce((s, p) => s + p.new_conversations, 0);

  return (
    <div className="glass-panel rounded-xl p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-light tracking-wide text-white">
            Conversaciones nuevas
          </h3>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-white/30">
            &Uacute;ltimos 14 d&iacute;as
          </p>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-[22px] font-light tracking-[-0.02em] text-white">
            {total14.toLocaleString()}
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
          <AreaChart data={last14} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
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
              dataKey="new_conversations"
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
