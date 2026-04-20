"use client";

import { useState, useCallback, useEffect } from "react";
import { X, Plus, Trash2, Users } from "lucide-react";

export interface CompetitorEntry {
  id?: string;
  name: string;
  ig_url: string;
  likes_brand: string;
  likes_content: string;
}

interface AdnCompetitorModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (competitors: CompetitorEntry[]) => Promise<void>;
  initialCompetitors?: CompetitorEntry[];
}

const EMPTY_ENTRY: CompetitorEntry = { name: "", ig_url: "", likes_brand: "", likes_content: "" };

export function AdnCompetitorModal({
  open,
  onClose,
  onSave,
  initialCompetitors,
}: AdnCompetitorModalProps) {
  const [entries, setEntries] = useState<CompetitorEntry[]>([
    { ...EMPTY_ENTRY },
    { ...EMPTY_ENTRY },
    { ...EMPTY_ENTRY },
  ]);
  const [saving, setSaving] = useState(false);

  // Re-sync entries when modal opens
  useEffect(() => {
    if (open) {
      if (initialCompetitors && initialCompetitors.length > 0) {
        setEntries(initialCompetitors.map((c) => ({ ...c })));
      } else {
        setEntries([{ ...EMPTY_ENTRY }, { ...EMPTY_ENTRY }, { ...EMPTY_ENTRY }]);
      }
    }
  }, [open, initialCompetitors]);

  const updateEntry = useCallback(
    (index: number, field: keyof CompetitorEntry, value: string) => {
      setEntries((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const addEntry = useCallback(() => {
    setEntries((prev) => [...prev, { ...EMPTY_ENTRY }]);
  }, []);

  const removeEntry = useCallback((index: number) => {
    setEntries((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  async function handleSave() {
    const valid = entries.filter((e) => e.name.trim().length > 0);
    if (valid.length === 0) return;

    setSaving(true);
    try {
      await onSave(valid);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const validCount = entries.filter((e) => e.name.trim().length > 0).length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-[640px] max-h-[85vh] flex flex-col rounded-xl border border-border bg-popover text-popover-foreground shadow-[0_24px_80px_rgba(0,0,0,0.08)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-violet-500/10 flex items-center justify-center">
              <Users size={16} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-light text-white/85 tracking-wide">
                Competidores
              </h2>
              <p className="text-[11px] text-white/30 font-light mt-0.5">
                Agregá tus competidores principales y qué te gusta de ellos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} className="text-white/30" />
          </button>
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 adn-scroll">
          {entries.map((entry, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-white/30 uppercase tracking-[0.08em]">
                  Competidor {i + 1}
                </p>
                {entries.length > 1 && (
                  <button
                    onClick={() => removeEntry(i)}
                    className="h-6 w-6 rounded-md hover:bg-red-500/10 flex items-center justify-center transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={12} className="text-red-400/60" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-white/25 font-medium mb-1 block">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={entry.name}
                    onChange={(e) => updateEntry(i, "name", e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/70 font-light placeholder:text-muted-foreground focus:outline-none focus:border-ring transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/25 font-medium mb-1 block">
                    Instagram
                  </label>
                  <input
                    type="text"
                    value={entry.ig_url}
                    onChange={(e) => updateEntry(i, "ig_url", e.target.value)}
                    placeholder="@usuario o URL"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/70 font-light placeholder:text-muted-foreground focus:outline-none focus:border-ring transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/25 font-medium mb-1 block">
                  ¿Qué te gusta de su marca?
                </label>
                <textarea
                  value={entry.likes_brand}
                  onChange={(e) => {
                    updateEntry(i, "likes_brand", e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  ref={(el) => {
                    if (el && entry.likes_brand) {
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }
                  }}
                  rows={1}
                  placeholder="Qué te llama la atención de su marca, posicionamiento, identidad..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/70 font-light placeholder:text-muted-foreground resize-none focus:outline-none focus:border-ring transition-colors overflow-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] text-white/25 font-medium mb-1 block">
                  ¿Qué te gusta de su contenido?
                </label>
                <textarea
                  value={entry.likes_content}
                  onChange={(e) => {
                    updateEntry(i, "likes_content", e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  ref={(el) => {
                    if (el && entry.likes_content) {
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }
                  }}
                  rows={1}
                  placeholder="Qué tipo de contenido hacen que te gusta, formatos, estilo..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/70 font-light placeholder:text-muted-foreground resize-none focus:outline-none focus:border-ring transition-colors overflow-hidden"
                />
              </div>
            </div>
          ))}

          {/* Add button */}
          <button
            onClick={addEntry}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02] transition-all cursor-pointer"
          >
            <Plus size={14} className="text-white/25" />
            <span className="text-[12px] text-white/30 font-light">
              Agregar otro competidor
            </span>
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06]">
          <p className="text-[11px] text-white/20 font-light">
            {validCount} competidor{validCount !== 1 ? "es" : ""} con nombre
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[12px] text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={validCount === 0 || saving}
              className="px-5 py-2 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/20 text-[12px] font-medium text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-violet-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? "Guardando..." : "Guardar competidores"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
