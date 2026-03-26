"use client";

import { useState, useCallback } from "react";
import type { AdnProgress, AdnData } from "@/services/adn-progress.service";

interface AdnDocsPanelProps {
  progress: AdnProgress;
  data: AdnData;
  workspaceId: string;
  onDataUpdate: (progress: AdnProgress, data: AdnData) => void;
  onEditCompetitors?: () => void;
}

// ─── Field label mapping ─────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  // Profile
  business_description: "Negocio",
  brand_persona: "Personaje de marca",
  avatar_description: "Avatar / Cliente ideal",
  target_audience: "Audiencia objetivo",
  main_offer: "Oferta principal",
  // Market
  industry_state: "Estado de la industria",
  audience_exposure: "Exposición del avatar",
  market_beliefs: "Creencias del mercado",
  burned_topics: "Temas quemados",
  current_trends: "Tendencias",
  competitiveness: "Competitividad",
  differentiator: "Diferenciador",
  // Brand
  why_clients_choose: "Por qué te eligen",
  niche_language: "Lenguaje de nicho",
  niche_tools: "Herramientas del nicho",
  filtering_words: "Palabras filtro",
  new_mechanisms: "Mecanismos nuevos",
  // Strategy
  what_tested: "Qué probaste",
  test_results: "Resultados",
  conclusions: "Conclusiones",
  current_strategy: "Estrategia actual",
  formats_and_quantity: "Formatos y cantidad",
  why_it_will_work: "Por qué va a funcionar",
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, " ");
}

// ─── Section config ──────────────────────────────────────────────────────────

interface SectionConfig {
  number: number;
  title: string;
  icon: string;
  progressKeys: readonly string[];
  totalFields: number;
}

const SECTIONS: SectionConfig[] = [
  { number: 1, title: "Documentos Base", icon: "1", progressKeys: ["profile"], totalFields: 5 },
  { number: 2, title: "Redes Sociales", icon: "2", progressKeys: ["strategies"], totalFields: 2 },
  { number: 3, title: "Competidores", icon: "3", progressKeys: ["market", "competitors"], totalFields: 8 },
  { number: 4, title: "Tu Marca", icon: "4", progressKeys: ["brand", "references"], totalFields: 6 },
];

function getSectionFieldCount(progress: AdnProgress, keys: readonly string[]): number {
  let count = 0;
  for (const k of keys) {
    const section = progress.sections[k as keyof typeof progress.sections];
    if ("fields_filled" in section) count += section.fields_filled.length;
    else if ("platforms" in section) count += section.platforms.length;
    else if ("count" in section) count += Math.min(section.count, 1);
  }
  return count;
}

function isSectionComplete(progress: AdnProgress, keys: readonly string[]): boolean {
  return keys.every((k) => progress.sections[k as keyof typeof progress.sections].complete);
}

// ─── Editable field component ────────────────────────────────────────────────

function EditableField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null;
  onSave: (newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  function handleSave() {
    setEditing(false);
    if (draft !== (value ?? "")) {
      onSave(draft);
    }
  }

  if (!value && !editing) {
    return (
      <div className="group flex items-start gap-2 py-1.5">
        <span className="text-[11px] text-white/20 font-light flex-1">{label}</span>
        <button
          onClick={() => setEditing(true)}
          className="text-[10px] text-white/15 hover:text-white/40 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
        >
          + agregar
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="py-1.5">
        <p className="text-[10px] text-white/30 font-medium mb-1">{label}</p>
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            }
            if (e.key === "Escape") {
              setEditing(false);
              setDraft(value ?? "");
            }
          }}
          ref={(el) => {
            if (el) {
              el.focus();
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }
          }}
          rows={1}
          className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-[11px] text-white/70 font-light resize-none focus:outline-none focus:border-white/[0.2] transition-colors overflow-hidden"
        />
      </div>
    );
  }

  return (
    <div
      className="group py-1.5 cursor-pointer"
      onClick={() => {
        setDraft(value ?? "");
        setEditing(true);
      }}
    >
      <p className="text-[10px] text-white/30 font-medium mb-0.5">{label}</p>
      <p className="text-[11px] text-white/55 font-light leading-relaxed group-hover:text-white/70 transition-colors">
        {value}
      </p>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AdnDocsPanel({ progress, data, workspaceId, onDataUpdate, onEditCompetitors }: AdnDocsPanelProps) {
  const [expandedSection, setExpandedSection] = useState<number | null>(
    progress.current_section
  );

  const totalPossible = SECTIONS.reduce((sum, s) => sum + s.totalFields, 0);
  const totalFilled = SECTIONS.reduce(
    (sum, s) => sum + Math.min(getSectionFieldCount(progress, s.progressKeys), s.totalFields),
    0
  );
  const percent = Math.round((totalFilled / totalPossible) * 100);

  const saveField = useCallback(
    async (table: string, field: string, value: string) => {
      try {
        const res = await fetch("/api/v1/onboarding/adn", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-workspace-id": workspaceId,
          },
          body: JSON.stringify({ table, data: { [field]: value } }),
        });
        if (res.ok) {
          const result = await res.json();
          onDataUpdate(result.data.progress, result.data.data);
        }
      } catch {
        // silent fail — field will revert on next load
      }
    },
    [workspaceId, onDataUpdate]
  );

  function toggleSection(num: number) {
    setExpandedSection((prev) => (prev === num ? null : num));
  }

  // ─── Render section content based on number ──────────────────────────────

  function renderSectionContent(sectionNumber: number) {
    switch (sectionNumber) {
      case 1:
        return renderKeyValueSection(data.profile, "workspace_profile", [
          "business_description",
          "brand_persona",
          "avatar_description",
          "target_audience",
          "main_offer",
        ]);

      case 2:
        return (
          <div className="space-y-3">
            {data.strategies.length === 0 ? (
              <p className="text-[11px] text-white/20 font-light italic">
                Sin datos todavía
              </p>
            ) : (
              data.strategies.map((strategy, i) => (
                <div key={i}>
                  <p className="text-[10px] font-medium text-white/40 uppercase tracking-wide mb-1">
                    {(strategy.platform as string) ?? "Plataforma"}
                  </p>
                  {["what_tested", "test_results", "conclusions", "current_strategy", "formats_and_quantity", "why_it_will_work"].map(
                    (field) =>
                      strategy[field] ? (
                        <div key={field} className="py-1">
                          <p className="text-[10px] text-white/25 font-medium mb-0.5">
                            {fieldLabel(field)}
                          </p>
                          <p className="text-[11px] text-white/50 font-light leading-relaxed line-clamp-2">
                            {strategy[field]}
                          </p>
                        </div>
                      ) : null
                  )}
                </div>
              ))
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-3">
            {renderKeyValueSection(data.market, "workspace_market", [
              "industry_state",
              "audience_exposure",
              "market_beliefs",
              "burned_topics",
              "current_trends",
              "competitiveness",
              "differentiator",
            ])}
            <div className="pt-2 border-t border-white/[0.04]">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-medium text-white/30 uppercase tracking-wide">
                  Competidores ({data.competitors.length})
                </p>
                <button
                  onClick={onEditCompetitors}
                  className="text-[10px] text-violet-400/60 hover:text-violet-400 transition-colors cursor-pointer"
                >
                  {data.competitors.length > 0 ? "editar" : "+ agregar"}
                </button>
              </div>
              {data.competitors.length > 0 ? (
                data.competitors.map((c, i) => (
                  <div key={i} className="py-1.5 group">
                    <p className="text-[11px] text-white/55 font-light">
                      {c.name}
                      {c.ig_url && (
                        <span className="text-white/25 ml-1.5">@{c.ig_url}</span>
                      )}
                    </p>
                    {c.why_better && (
                      <p className="text-[10px] text-white/25 font-light mt-0.5 leading-relaxed">
                        {c.why_better}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-white/20 font-light italic py-1">
                  Sin competidores cargados
                </p>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-3">
            {renderKeyValueSection(data.brand, "workspace_brand", [
              "why_clients_choose",
              "niche_language",
              "niche_tools",
              "filtering_words",
              "new_mechanisms",
            ])}
            {data.references.length > 0 && (
              <div className="pt-2 border-t border-white/[0.04]">
                <p className="text-[10px] font-medium text-white/30 uppercase tracking-wide mb-1">
                  Referencias ({data.references.length})
                </p>
                {data.references.map((r, i) => (
                  <div key={i} className="py-1">
                    <p className="text-[11px] text-white/55 font-light">
                      {r.brand_name}
                      {r.what_they_like && (
                        <span className="text-white/30 ml-1">— {r.what_they_like}</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  }

  function renderKeyValueSection(
    row: Record<string, string | null> | null,
    table: string,
    fields: string[]
  ) {
    const hasAnyData = row && fields.some((f) => row[f]);

    if (!hasAnyData && !row) {
      return (
        <p className="text-[11px] text-white/20 font-light italic">
          Sin datos todavía
        </p>
      );
    }

    return (
      <div className="space-y-0.5">
        {fields.map((field) => (
          <EditableField
            key={field}
            label={fieldLabel(field)}
            value={row?.[field] ?? null}
            onSave={(newValue) => saveField(table, field, newValue)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header + progress */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-2.5">
          <p className="text-[11px] font-medium text-white/35 tracking-[0.06em] uppercase">
            ADN
          </p>
          <p className="text-[22px] font-light text-white/80 tracking-[-0.02em]">
            {percent}
            <span className="text-[13px] text-white/30 ml-0.5">%</span>
          </p>
        </div>
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${percent}%`,
              background: "linear-gradient(90deg, rgba(52,211,153,0.5) 0%, rgba(52,211,153,0.9) 100%)",
              boxShadow: percent > 0 ? "0 0 8px rgba(52,211,153,0.3)" : "none",
            }}
          />
        </div>
      </div>

      {/* Sections accordion */}
      <div className="flex-1 overflow-y-auto adn-scroll space-y-1">
        {SECTIONS.map((section) => {
          const complete = isSectionComplete(progress, section.progressKeys);
          const active = progress.current_section === section.number;
          const expanded = expandedSection === section.number;
          const fieldCount = getSectionFieldCount(progress, section.progressKeys);

          return (
            <div key={section.number}>
              {/* Section header — clickable */}
              <button
                onClick={() => toggleSection(section.number)}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all duration-200 cursor-pointer text-left ${
                  expanded
                    ? "bg-white/[0.05]"
                    : "hover:bg-white/[0.03]"
                }`}
              >
                {/* Number/check */}
                <div
                  className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[11px] transition-all duration-300 ${
                    complete
                      ? "bg-emerald-500/15 text-emerald-400"
                      : active
                      ? "bg-white/[0.1] text-white/70"
                      : "bg-white/[0.04] text-white/20"
                  }`}
                >
                  {complete ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    section.icon
                  )}
                </div>

                {/* Title + count */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[12px] transition-colors duration-300 ${
                      active || expanded
                        ? "font-medium text-white/80"
                        : complete
                        ? "font-light text-white/45"
                        : "font-light text-white/25"
                    }`}
                  >
                    {section.title}
                  </p>
                  {fieldCount > 0 && (
                    <p className="text-[10px] text-white/20 font-light">
                      {fieldCount} campo{fieldCount !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                {/* Chevron */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`shrink-0 text-white/20 transition-transform duration-200 ${
                    expanded ? "rotate-180" : ""
                  }`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Expanded content */}
              {expanded && (
                <div className="px-3 pb-3 pt-1 ml-[34px]">
                  {renderSectionContent(section.number)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom hint */}
      <div className="mt-3 pt-3 border-t border-white/[0.04]">
        <p className="text-[10px] text-white/15 font-light leading-relaxed">
          Hacé click en una sección para ver y editar los datos capturados.
        </p>
      </div>
    </div>
  );
}
