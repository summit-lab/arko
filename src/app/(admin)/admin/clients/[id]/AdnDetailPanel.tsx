"use client";

import { useState } from "react";
import { ChevronDown, User, Globe, TrendingUp, Users, Palette, Bookmark } from "lucide-react";

interface AdnSection {
  name: string;
  done: boolean;
}

interface AdnData {
  profile: {
    business_description: string | null;
    brand_persona: string | null;
    avatar_description: string | null;
    target_audience: string | null;
    main_offer: string | null;
  } | null;
  strategies: {
    platform: string;
    what_tested: string | null;
    test_results: string | null;
    conclusions: string | null;
    current_strategy: string | null;
    formats_and_quantity: string | null;
    why_it_will_work: string | null;
  }[];
  market: {
    industry_state: string | null;
    audience_exposure: string | null;
    market_beliefs: string | null;
    burned_topics: string | null;
    current_trends: string | null;
    competitiveness: string | null;
    differentiator: string | null;
  } | null;
  competitors: {
    name: string | null;
    ig_url: string | null;
    why_better: string | null;
  }[];
  brand: {
    why_clients_choose: string | null;
    niche_language: string | null;
    niche_tools: string | null;
    filtering_words: string | null;
    new_mechanisms: string | null;
  } | null;
  references: {
    brand_name: string | null;
    brand_url: string | null;
    what_they_like: string | null;
  }[];
}

interface AdnDetailPanelProps {
  sections: AdnSection[];
  data: AdnData;
}

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="py-2">
      <p className="text-[10px] text-white/25 uppercase tracking-[0.08em] font-medium mb-1">{label}</p>
      <p className="text-[12px] text-white/60 font-light leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

const SECTION_ICONS = [
  <User key="p" size={13} className="text-blue-400" />,
  <Globe key="s" size={13} className="text-violet-400" />,
  <TrendingUp key="m" size={13} className="text-amber-400" />,
  <Users key="c" size={13} className="text-rose-400" />,
  <Palette key="b" size={13} className="text-emerald-400" />,
  <Bookmark key="r" size={13} className="text-cyan-400" />,
];

export function AdnDetailPanel({ sections, data }: AdnDetailPanelProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const completedCount = sections.filter((s) => s.done).length;

  return (
    <div className="glass-panel rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-light text-white tracking-wide">
          ADN de Comunicación
        </h3>
        <span className="text-[11px] text-white/25 font-light">
          {completedCount}/{sections.length} secciones
        </span>
      </div>

      <div className="space-y-2">
        {sections.map((s, i) => {
          const isOpen = expanded.has(i);
          const hasContent = s.done;

          return (
            <div key={s.name} className="rounded-xl border border-white/[0.04] bg-white/[0.02] overflow-hidden">
              {/* Header — always clickable */}
              <button
                onClick={() => hasContent && toggle(i)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                  hasContent ? "hover:bg-white/[0.03] cursor-pointer" : "cursor-default"
                }`}
              >
                {SECTION_ICONS[i]}
                <span className={`text-[12px] font-light flex-1 text-left ${s.done ? "text-white/60" : "text-white/25"}`}>
                  {s.name}
                </span>
                <span className={`h-2 w-2 rounded-full shrink-0 ${s.done ? "bg-emerald-400" : "bg-white/10"}`} />
                {hasContent && (
                  <ChevronDown
                    size={14}
                    className={`text-white/20 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                )}
              </button>

              {/* Expandable content */}
              {isOpen && hasContent && (
                <div className="px-4 pb-4 border-t border-white/[0.04]">
                  <div className="pt-3 space-y-1">
                    {i === 0 && data.profile && (
                      <>
                        <FieldRow label="Oferta principal" value={data.profile.main_offer} />
                        <FieldRow label="Descripción del negocio" value={data.profile.business_description} />
                        <FieldRow label="Personaje de marca" value={data.profile.brand_persona} />
                        <FieldRow label="Avatar / cliente ideal" value={data.profile.avatar_description} />
                        <FieldRow label="Audiencia objetivo" value={data.profile.target_audience} />
                      </>
                    )}

                    {i === 1 && data.strategies.length > 0 && (
                      <div className="space-y-4">
                        {data.strategies.map((st) => (
                          <div key={st.platform} className="space-y-1">
                            <p className="text-[11px] font-medium text-violet-400/70 uppercase tracking-wider mb-2">
                              {st.platform}
                            </p>
                            <FieldRow label="Qué probó" value={st.what_tested} />
                            <FieldRow label="Resultados" value={st.test_results} />
                            <FieldRow label="Conclusiones" value={st.conclusions} />
                            <FieldRow label="Estrategia actual" value={st.current_strategy} />
                            <FieldRow label="Formatos y cantidad" value={st.formats_and_quantity} />
                            <FieldRow label="Por qué va a funcionar" value={st.why_it_will_work} />
                          </div>
                        ))}
                      </div>
                    )}

                    {i === 2 && data.market && (
                      <>
                        <FieldRow label="Estado de la industria" value={data.market.industry_state} />
                        <FieldRow label="Exposición de la audiencia" value={data.market.audience_exposure} />
                        <FieldRow label="Creencias del mercado" value={data.market.market_beliefs} />
                        <FieldRow label="Temas quemados" value={data.market.burned_topics} />
                        <FieldRow label="Tendencias actuales" value={data.market.current_trends} />
                        <FieldRow label="Competitividad" value={data.market.competitiveness} />
                        <FieldRow label="Diferenciador" value={data.market.differentiator} />
                      </>
                    )}

                    {i === 3 && data.competitors.length > 0 && (
                      <div className="space-y-3">
                        {data.competitors.map((c, ci) => (
                          <div key={ci} className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-[12px] font-light text-white/60">{c.name || "Sin nombre"}</p>
                              {c.ig_url && (
                                <span className="text-[10px] text-rose-400/50 font-light">{c.ig_url}</span>
                              )}
                            </div>
                            {c.why_better && (
                              <p className="text-[11px] text-white/35 font-light leading-relaxed">{c.why_better}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {i === 4 && data.brand && (
                      <>
                        <FieldRow label="Por qué te eligen" value={data.brand.why_clients_choose} />
                        <FieldRow label="Lenguaje de nicho" value={data.brand.niche_language} />
                        <FieldRow label="Herramientas de nicho" value={data.brand.niche_tools} />
                        <FieldRow label="Palabras de filtrado" value={data.brand.filtering_words} />
                        <FieldRow label="Mecanismos nuevos" value={data.brand.new_mechanisms} />
                      </>
                    )}

                    {i === 5 && data.references.length > 0 && (
                      <div className="space-y-3">
                        {data.references.map((r, ri) => (
                          <div key={ri} className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-[12px] font-light text-white/60">{r.brand_name || "Sin nombre"}</p>
                              {r.brand_url && (
                                <span className="text-[10px] text-cyan-400/50 font-light">{r.brand_url}</span>
                              )}
                            </div>
                            {r.what_they_like && (
                              <p className="text-[11px] text-white/35 font-light leading-relaxed">{r.what_they_like}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
