"use client";

import { useState, useTransition } from "react";
import { Plus, X, Target } from "lucide-react";
import { upsertGoal, deleteGoal } from "@/app/(dashboard)/customer-voice/actions";

interface Goal {
  metric: string;
  target_value: number;
}

const METRIC_OPTIONS = [
  { value: "views", label: "Views totales", unit: "" },
  { value: "followers", label: "Seguidores", unit: "" },
  { value: "likes", label: "Likes", unit: "" },
  { value: "saves", label: "Guardados", unit: "" },
  { value: "reach", label: "Alcance", unit: "" },
  { value: "engagement_rate", label: "Engagement Rate", unit: "%" },
] as const;

export function GoalEditor({ goals }: { goals: Goal[] }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [isPending, startTransition] = useTransition();

  const existingMetrics = new Set(goals.map((g) => g.metric));
  const availableMetrics = METRIC_OPTIONS.filter((m) => !existingMetrics.has(m.value));

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

  return (
    <div className="glass-panel rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-zinc-300">Metas Mensuales</h3>
        </div>
        {availableMetrics.length > 0 && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar meta
          </button>
        )}
      </div>

      {/* Existing goals */}
      {goals.length > 0 ? (
        <div className="space-y-3 mb-4">
          {goals.map((g) => {
            const meta = METRIC_OPTIONS.find((m) => m.value === g.metric);
            return (
              <div
                key={g.metric}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5"
              >
                <div className="flex-1">
                  <p className="text-xs font-medium text-zinc-300">{meta?.label || g.metric}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <input
                      type="number"
                      defaultValue={g.target_value}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (val !== g.target_value && val > 0) handleUpdate(g.metric, val);
                      }}
                      className="w-28 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500/30"
                    />
                    {meta?.unit && <span className="text-[10px] text-zinc-500">{meta.unit}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(g.metric)}
                  disabled={isPending}
                  className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-zinc-500 mb-4">
          No tenés metas configuradas. Agregá una para trackear tu progreso en el Dashboard.
        </p>
      )}

      {/* Add new goal form */}
      {showForm && (
        <div className="p-3 rounded-lg bg-white/5 border border-cyan-500/10 space-y-3">
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500/30"
          >
            <option value="" className="bg-zinc-900">Seleccionar métrica...</option>
            {availableMetrics.map((m) => (
              <option key={m.value} value={m.value} className="bg-zinc-900">
                {m.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder="Valor objetivo"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-cyan-500/30"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={isPending || !selectedMetric || !targetValue}
              className="flex-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 text-xs font-medium py-2 rounded-lg hover:bg-cyan-500/30 transition-colors disabled:opacity-40"
            >
              {isPending ? "Guardando..." : "Guardar"}
            </button>
            <button
              onClick={() => { setShowForm(false); setSelectedMetric(""); setTargetValue(""); }}
              className="px-3 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
