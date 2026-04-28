"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Target, Pencil, Trash2, Plus, Check, X, ChevronDown } from "lucide-react";
import { upsertGoal, deleteGoal } from "@/app/(dashboard)/customer-voice/actions";

function MetricSelect({
  value,
  onChange,
  options,
  labels,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  labels: Record<string, string>;
  placeholder?: string;
}) {
  const t = useTranslations("settingsMetas.editor");
  const ph = placeholder ?? t("selectMetric");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const selectedLabel = value ? (labels[value] ?? value) : ph;

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-1.5 rounded-md text-[13px] font-light bg-white/[0.06] border border-white/[0.1] outline-none cursor-pointer hover:bg-white/[0.08] transition-colors"
      >
        <span className={value ? "text-white" : "text-white/40"}>{selectedLabel}</span>
        <ChevronDown
          size={12}
          strokeWidth={2}
          className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl backdrop-blur-xl">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-muted-foreground">{t("noMetricsAvailable")}</div>
          ) : (
            options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`flex w-full items-center justify-between gap-4 px-3 py-2 text-[12px] font-light transition-colors hover:bg-white/[0.08] cursor-pointer ${
                  opt === value ? "text-popover-foreground" : "text-muted-foreground hover:text-popover-foreground"
                }`}
              >
                <span>{labels[opt] ?? opt}</span>
                {opt === value && <Check size={12} strokeWidth={2.5} />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface MetasEditorProps {
  goals: Record<string, number>;
  metricLabels: Record<string, string>;
}

const ALL_METRICS = ["views", "followers", "engagement_rate", "likes", "saves", "reach"] as const;

const METRIC_UNITS: Record<string, string> = {
  engagement_rate: "%",
};

const METRIC_STEP: Record<string, number> = {
  engagement_rate: 0.1,
};

export function MetasEditor({ goals, metricLabels }: MetasEditorProps) {
  const t = useTranslations("settingsMetas.editor");
  const locale = useLocale();
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [newMetric, setNewMetric] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isPending, startTransition] = useTransition();

  const configuredMetrics = Object.keys(goals);
  const availableMetrics = ALL_METRICS.filter((m) => !configuredMetrics.includes(m));

  function handleEdit(metric: string) {
    setEditing(metric);
    setEditValue(String(goals[metric]));
  }

  function handleSaveEdit(metric: string) {
    const val = parseFloat(editValue);
    if (isNaN(val) || val <= 0) return;
    startTransition(async () => {
      await upsertGoal(metric, val);
      setEditing(null);
    });
  }

  function handleDelete(metric: string) {
    startTransition(async () => {
      await deleteGoal(metric);
    });
  }

  function handleAdd() {
    if (!newMetric || !newValue) return;
    const val = parseFloat(newValue);
    if (isNaN(val) || val <= 0) return;
    startTransition(async () => {
      await upsertGoal(newMetric, val);
      setAdding(false);
      setNewMetric("");
      setNewValue("");
    });
  }

  function fmtValue(metric: string, value: number): string {
    const unit = METRIC_UNITS[metric];
    if (unit === "%") return `${value}%`;
    return value.toLocaleString(locale === "en" ? "en-US" : "es-AR");
  }

  return (
    <div className="space-y-4">
      {/* Configured goals */}
      <div className="glass-panel rounded-xl p-6 space-y-1">
        <h3 className="text-[13px] font-medium text-white/40 uppercase tracking-[0.1em] mb-4">
          {t("active")}
        </h3>

        {configuredMetrics.length === 0 && !adding && (
          <div className="py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
              <Target className="h-6 w-6 text-white/20" />
            </div>
            <p className="text-[13px] text-white/30 font-light">{t("empty")}</p>
          </div>
        )}

        <div className="space-y-2">
          {configuredMetrics.map((metric) => (
            <div
              key={metric}
              className="flex items-center justify-between px-4 py-3 rounded-lg bg-white/[0.03] border border-white/[0.06]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-white/70 font-light">{metricLabels[metric] ?? metric}</p>
              </div>

              {editing === metric ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    step={METRIC_STEP[metric] ?? 1}
                    min={0}
                    className="w-28 px-2 py-1 rounded-md text-[13px] text-white font-light bg-white/[0.06] border border-white/[0.1] outline-none focus:border-ring"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(metric);
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                  <button
                    onClick={() => handleSaveEdit(metric)}
                    disabled={isPending}
                    className="h-7 w-7 rounded-md flex items-center justify-center bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="h-7 w-7 rounded-md flex items-center justify-center bg-white/[0.04] text-white/30 hover:text-white/50 transition-colors cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-[14px] text-white font-light">{fmtValue(metric, goals[metric])}</span>
                  <button
                    onClick={() => handleEdit(metric)}
                    className="h-7 w-7 rounded-md flex items-center justify-center bg-white/[0.04] text-white/25 hover:text-white/50 transition-colors cursor-pointer"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(metric)}
                    disabled={isPending}
                    className="h-7 w-7 rounded-md flex items-center justify-center bg-white/[0.04] text-white/25 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add new goal */}
        {adding ? (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg mt-2 bg-white/[0.03]"
            style={{ border: "1px solid rgba(122,134,224,0.2)" }}
          >
            <MetricSelect
              value={newMetric}
              onChange={setNewMetric}
              options={availableMetrics}
              labels={metricLabels}
            />
            <input
              type="number"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={t("targetPlaceholder")}
              step={newMetric ? (METRIC_STEP[newMetric] ?? 1) : 1}
              min={0}
              className="w-28 px-2 py-1.5 rounded-md text-[13px] text-white font-light bg-white/[0.06] border border-white/[0.1] outline-none focus:border-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setAdding(false); setNewMetric(""); setNewValue(""); }
              }}
            />
            <button
              onClick={handleAdd}
              disabled={isPending || !newMetric || !newValue}
              className="h-8 px-3 rounded-md flex items-center gap-1.5 text-[12px] font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Check className="h-3.5 w-3.5" />
              {t("save")}
            </button>
            <button
              onClick={() => { setAdding(false); setNewMetric(""); setNewValue(""); }}
              className="h-8 w-8 rounded-md flex items-center justify-center bg-white/[0.04] text-white/30 hover:text-white/50 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          availableMetrics.length > 0 && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 px-4 py-2.5 mt-2 rounded-lg text-[12px] font-medium transition-colors cursor-pointer hover:bg-white/[0.04]"
              style={{ color: "rgba(122,134,224,0.8)" }}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("addGoal")}
            </button>
          )
        )}
      </div>
    </div>
  );
}
