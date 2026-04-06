"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface DonutProps {
  pct: number;
  color: string;
  label: string;
  current: string;
  goal: string;
}

function SingleDonut({ pct, color, label, current, goal }: DonutProps) {
  const data = [
    { value: pct },
    { value: 100 - pct },
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
          <span className="text-[13px] font-light text-white">{pct}%</span>
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

interface MetasDonutProps {
  views: string;
  followers: string;
  engRate: string;
}

export function MetasDonut({ views, followers, engRate }: MetasDonutProps) {
  return (
    <div className="glass-panel rounded-xl p-6 animate-slide-up stagger-3">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[13px] font-medium text-white/40 uppercase tracking-[0.1em]">Metas del Mes</h3>
        <a href="/settings/metas" className="text-[10px] text-white/20 hover:text-white/50 transition-colors tracking-wider">
          Configurar →
        </a>
      </div>
      <div className="flex items-start justify-around">
        <SingleDonut pct={72} color="#7A86E0" label="Views" current={views} goal="100K" />
        <SingleDonut pct={48} color="#4BCEAF" label="Seguidores" current={followers} goal="200" />
        <SingleDonut pct={63} color="#AF6EC7" label="Eng. Rate" current={engRate} goal="3%" />
      </div>
    </div>
  );
}
