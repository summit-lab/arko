"use client";

import { useState, useTransition } from "react";
import { Plus, X, Target, TrendingUp, ArrowUpRight } from "lucide-react";
import { upsertGoal, deleteGoal } from "@/app/(dashboard)/customer-voice/actions";

// ─── Types ───

interface Goal {
  metric: string;
  target_value: number;
}

interface GoalInsights {
  totalViews: number;
  totalFollowers: number;
  totalLikes: number;
  totalSaves: number;
  totalReach: number;
  engagementRate: number;
}

interface IGGoalsProps {
  goals: Goal[];
  insights: GoalInsights;
}

// ─── Metric config ───

const METRIC_CONFIG: Record<string, { label: string; unit: string; color: string; glowColor: string }> = {
  views: { label: "Views totales", unit: "", color: "#818cf8", glowColor: "rgba(129, 140, 248, 0.3)" },
  followers: { label: "Seguidores", unit: "", color: "#22d3ee", glowColor: "rgba(34, 211, 238, 0.3)" },
  likes: { label: "Likes", unit: "", color: "#f472b6", glowColor: "rgba(244, 114, 182, 0.3)" },
  saves: { label: "Guardados", unit: "", color: "#a78bfa", glowColor: "rgba(167, 139, 250, 0.3)" },
  reach: { label: "Alcance", unit: "", color: "#34d399", glowColor: "rgba(52, 211, 153, 0.3)" },
  engagement_rate: { label: "Engagement Rate", unit: "%", color: "#fbbf24", glowColor: "rgba(251, 191, 36, 0.3)" },
};

const METRIC_OPTIONS = Object.entries(METRIC_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
  unit: cfg.unit,
}));

// ─── Helpers ───

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("es-AR");
}

function getCurrentValue(metric: string, insights: GoalInsights): number {
  switch (metric) {
    case "views": return insights.totalViews;
    case "followers": return insights.totalFollowers;
    case "likes": return insights.totalLikes;
    case "saves": return insights.totalSaves;
    case "reach": return insights.totalReach;
    case "engagement_rate": return insights.engagementRate;
    default: return 0;
  }
}

function getDaysProgress(): { elapsed: number; total: number; pct: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const total = end.getDate();
  const elapsed = now.getDate();
  return { elapsed, total, pct: Math.round((elapsed / total) * 100) };
}

// ─── Circular progress ───

function CircularProgress({ pct, color, size = 100 }: { pct: number; color: string; size?: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, pct));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="var(--border)" strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)",
          filter: `drop-shadow(0 0 6px ${color}80)`,
        }}
      />
    </svg>
  );
}

// ─── Goal card ───

function GoalCard({
  goal, insights, onDelete, onUpdate, isPending,
}: {
  goal: Goal;
  insights: GoalInsights;
  onDelete: (metric: string) => void;
  onUpdate: (metric: string, value: number) => void;
  isPending: boolean;
}) {
  const cfg = METRIC_CONFIG[goal.metric] || { label: goal.metric, unit: "", color: "#818cf8", glowColor: "rgba(129,140,248,0.3)" };
  const current = getCurrentValue(goal.metric, insights);
  const pct = goal.target_value > 0 ? Math.round((current / goal.target_value) * 100) : 0;
  const remaining = Math.max(0, goal.target_value - current);
  const days = getDaysProgress();
  const isAhead = pct >= days.pct;

  return (
    <div className="glass-card p-6 rounded-xl relative group">
      <button
        onClick={() => onDelete(goal.metric)}
        disabled={isPending}
        className="absolute top-4 right-4 text-white/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>

      <p className="stat-label mb-4">{cfg.label}</p>

      <div className="flex items-center gap-6">
        {/* Circular progress */}
        <div className="relative flex-shrink-0">
          <CircularProgress pct={pct} color={cfg.color} size={90} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[18px] font-light text-white tracking-tight">{pct}%</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <span className="text-[24px] font-light tracking-[-0.02em] text-white">
              {goal.metric === "engagement_rate" ? `${current.toFixed(2)}%` : fmt(current)}
            </span>
            <span className="text-[11px] text-white/30 ml-2">
              / {goal.metric === "engagement_rate" ? `${goal.target_value}%` : fmt(goal.target_value)}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${Math.min(100, pct)}%`,
                background: `linear-gradient(90deg, ${cfg.color}80, ${cfg.color})`,
                boxShadow: `0 0 8px ${cfg.glowColor}`,
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-white/30">
              Faltan {goal.metric === "engagement_rate" ? `${remaining.toFixed(2)}%` : fmt(remaining)}
            </span>
            <div className={`flex items-center gap-1 text-[11px] font-medium ${isAhead ? "text-emerald-400" : "text-amber-400"}`}>
              <ArrowUpRight className="h-3 w-3" />
              {isAhead ? "Adelante" : "Por detrás"} del ritmo
            </div>
          </div>
        </div>
      </div>

      {/* Editable target */}
      <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center gap-2">
        <span className="text-[10px] text-white/20 uppercase tracking-wider">Meta:</span>
        <input
          type="number"
          defaultValue={goal.target_value}
          onBlur={(e) => {
            const val = Number(e.target.value);
            if (val !== goal.target_value && val > 0) onUpdate(goal.metric, val);
          }}
          className="w-24 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1 text-[12px] text-white/70 outline-none focus:border-white/[0.1] transition-colors"
        />
        {cfg.unit && <span className="text-[10px] text-white/20">{cfg.unit}</span>}
      </div>
    </div>
  );
}

// ─── Main component ───

export function IGGoals({ goals, insights }: IGGoalsProps) {
  const [showForm, setShowForm] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [isPending, startTransition] = useTransition();

  const existingMetrics = new Set(goals.map((g) => g.metric));
  const availableMetrics = METRIC_OPTIONS.filter((m) => !existingMetrics.has(m.value));
  const days = getDaysProgress();

  function handleAdd() {
    if (!selectedMetric || !targetValue) return;
    startTransition(async () => {
      await upsertGoal(selectedMetric, Number(targetValue));
      setSelectedMetric("");
      setTargetValue("");
      setShowForm(false);
    });
  }

  function handleDelete(metric: string) {
    startTransition(async () => {
      await deleteGoal(metric);
    });
  }

  function handleUpdate(metric: string, newTarget: number) {
    if (newTarget <= 0) return;
    startTransition(async () => {
      await upsertGoal(metric, newTarget);
    });
  }

  const monthName = new Date().toLocaleDateString("es-AR", { month: "long" });

  return (
    <div className={`space-y-8 transition-opacity duration-200 ${isPending ? "opacity-60" : "opacity-100"}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "rgba(34, 211, 238, 0.1)", border: "1px solid rgba(34, 211, 238, 0.2)" }}
          >
            <Target className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-[20px] font-light text-white tracking-tight capitalize">
              Metas de {monthName}
            </h2>
            <p className="text-[12px] text-white/30 mt-0.5">
              Día {days.elapsed} de {days.total} — {days.pct}% del mes
            </p>
          </div>
        </div>
        {availableMetrics.length > 0 && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 text-[13px] font-medium text-cyan-400 px-4 py-2 rounded-full transition-all hover:bg-white/[0.04] cursor-pointer"
            style={{ border: "1px solid rgba(34, 211, 238, 0.15)" }}
          >
            <Plus className="h-4 w-4" />
            Agregar meta
          </button>
        )}
      </div>

      {/* Month progress bar */}
      <div className="glass-section p-5 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="stat-label">Progreso del mes</span>
          <span className="text-[12px] text-white/40">{days.pct}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${days.pct}%`,
              background: "linear-gradient(90deg, rgba(34, 211, 238, 0.5), rgba(34, 211, 238, 0.9))",
              boxShadow: "0 0 12px rgba(34, 211, 238, 0.3)",
            }}
          />
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="glass-card p-6 rounded-xl space-y-4 animate-fade-in">
          <p className="text-[13px] text-white/60 font-medium">Nueva meta</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-white outline-none focus:border-white/[0.1] transition-colors cursor-pointer"
            >
              <option value="" className="bg-popover text-popover-foreground">Seleccionar métrica...</option>
              {availableMetrics.map((m) => (
                <option key={m.value} value={m.value} className="bg-popover text-popover-foreground">
                  {m.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="Valor objetivo"
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none focus:border-white/[0.1] transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={isPending || !selectedMetric || !targetValue}
                className="flex-1 bg-cyan-500/15 text-cyan-300 border border-cyan-500/20 text-[13px] font-medium py-2.5 rounded-xl hover:bg-cyan-500/25 transition-colors disabled:opacity-40 cursor-pointer"
              >
                Guardar
              </button>
              <button
                onClick={() => { setShowForm(false); setSelectedMetric(""); setTargetValue(""); }}
                className="px-4 text-[13px] text-white/30 hover:text-white/60 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goal cards */}
      {goals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {goals.map((g) => (
            <GoalCard
              key={g.metric}
              goal={g}
              insights={insights}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              isPending={isPending}
            />
          ))}
        </div>
      ) : !showForm ? (
        <div className="glass-section p-12 rounded-xl flex flex-col items-center justify-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full mb-4 bg-white/[0.04] border border-white/[0.06]">
            <TrendingUp className="h-6 w-6 text-white/20" />
          </div>
          <p className="text-[15px] text-white/40 font-light">No tenés metas configuradas</p>
          <p className="text-[12px] text-white/20 mt-1 max-w-sm">
            Definí objetivos mensuales para views, seguidores, engagement y más. Vas a poder trackear tu progreso en tiempo real.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-5 flex items-center gap-2 text-[13px] font-medium text-cyan-400 px-5 py-2.5 rounded-full transition-all hover:bg-white/[0.04] cursor-pointer"
            style={{ border: "1px solid rgba(34, 211, 238, 0.2)" }}
          >
            <Plus className="h-4 w-4" />
            Crear primera meta
          </button>
        </div>
      ) : null}
    </div>
  );
}
