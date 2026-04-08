"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCompact(n: number, unit?: string): string {
  if (unit === "%") return `${n.toFixed(1)}%`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

// ─── Single Donut ────────────────────────────────────────────────────────────

interface DonutProps {
  pct: number;
  color: string;
  label: string;
  current: string;
  goal: string;
}

function SingleDonut({ pct, color, label, current, goal }: DonutProps) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  const data = [
    { value: clamped },
    { value: 100 - clamped },
  ];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-[80px] h-[80px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={36}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              strokeWidth={0}
            >
              <Cell fill={color} opacity={0.85} />
              <Cell fill="rgba(255,255,255,0.05)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[13px] font-light text-white">{Math.round(clamped)}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] text-white/50 font-light">{label}</p>
        <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
          <span className="text-[12px] text-white font-light">{current}</span>
          <span className="text-[9px] text-white/20">/{goal}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface MetasDonutProps {
  views: number;
  followers: number;
  engRate: number;
  goalViews: number | null;
  goalFollowers: number | null;
  goalEngRate: number | null;
}

export function MetasDonut({ views, followers, engRate, goalViews, goalFollowers, goalEngRate }: MetasDonutProps) {
  const hasGoals = goalViews !== null || goalFollowers !== null || goalEngRate !== null;

  // Build donut items dynamically from configured goals
  const items: DonutProps[] = [];

  if (goalViews !== null && goalViews > 0) {
    items.push({
      pct: (views / goalViews) * 100,
      color: "#7A86E0",
      label: "Views",
      current: fmtCompact(views),
      goal: fmtCompact(goalViews),
    });
  }

  if (goalFollowers !== null && goalFollowers > 0) {
    items.push({
      pct: (followers / goalFollowers) * 100,
      color: "#4BCEAF",
      label: "Seguidores",
      current: fmtCompact(followers),
      goal: fmtCompact(goalFollowers),
    });
  }

  if (goalEngRate !== null && goalEngRate > 0) {
    items.push({
      pct: (engRate / goalEngRate) * 100,
      color: "#AF6EC7",
      label: "Eng. Rate",
      current: fmtCompact(engRate, "%"),
      goal: fmtCompact(goalEngRate, "%"),
    });
  }

  return (
    <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-3">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[13px] font-medium text-white/40 uppercase tracking-[0.1em]">Metas del Mes</h3>
        <a href="/settings/metas" className="text-[10px] text-white/20 hover:text-white/50 transition-colors tracking-wider">
          Configurar →
        </a>
      </div>

      {!hasGoals ? (
        <div className="py-6 text-center">
          <p className="text-[12px] text-white/25 font-light">No hay metas configuradas</p>
          <a
            href="/settings/metas"
            className="inline-block mt-2 text-[11px] font-medium transition-colors hover:text-white/60"
            style={{ color: "rgba(122,134,224,0.7)" }}
          >
            + Configurar metas
          </a>
        </div>
      ) : (
        <div className="flex items-start justify-around">
          {items.map(item => (
            <SingleDonut key={item.label} {...item} />
          ))}
        </div>
      )}
    </div>
  );
}
