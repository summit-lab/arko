"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdnData } from "@/services/adn-progress.service";

interface AdnEditorProps {
  adnData: AdnData;
  workspaceId: string;
}

// ─── Field component ───────────────────────────────────────────────────────────

function EditableField({
  label,
  value,
  onSave,
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string | null;
  onSave: (val: string) => Promise<void>;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  }

  function handleCancel() {
    setDraft(value ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <label className="block text-[10px] text-white/35 uppercase tracking-wider font-medium">{label}</label>
        {multiline ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full rounded-lg bg-white/[0.05] border border-white/[0.12] px-3 py-2.5 text-sm text-white/80 placeholder:text-muted-foreground focus:outline-none focus:border-ring transition-all resize-none"
            placeholder={placeholder}
          />
        ) : (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded-lg bg-white/[0.05] border border-white/[0.12] px-3 py-2 text-sm text-white/80 placeholder:text-muted-foreground focus:outline-none focus:border-ring transition-all"
            placeholder={placeholder}
          />
        )}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-white/[0.08] border border-white/[0.12] text-[12px] text-white/70 hover:bg-white/[0.12] transition-all cursor-pointer disabled:opacity-40"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 rounded-lg text-[12px] text-white/30 hover:text-white/55 transition-all cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group cursor-pointer rounded-lg px-3 py-2 -mx-3 hover:bg-white/[0.03] transition-all"
      onClick={() => setEditing(true)}
    >
      <p className="text-[10px] text-white/25 uppercase tracking-wider font-medium mb-1">{label}</p>
      {value ? (
        <p className="text-[13px] text-white/65 font-light leading-relaxed">{value}</p>
      ) : (
        <p className="text-[13px] text-white/20 font-light italic">Sin completar — hacé click para editar</p>
      )}
      <p className="text-[10px] text-white/15 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        Click para editar
      </p>
    </div>
  );
}

// ─── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, complete, children }: { title: string; complete: boolean; children: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${complete ? "bg-emerald-400" : "bg-white/20"}`} />
        <h3 className="text-[13px] font-medium text-white/50 uppercase tracking-[0.1em]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdnEditor({ adnData, workspaceId }: AdnEditorProps) {
  const supabase = createClient();

  async function updateProfile(field: string, value: string) {
    await supabase
      .from("workspace_profile")
      .upsert({ workspace_id: workspaceId, [field]: value }, { onConflict: "workspace_id" });
  }

  async function updateMarket(field: string, value: string) {
    await supabase
      .from("workspace_market")
      .upsert({ workspace_id: workspaceId, [field]: value }, { onConflict: "workspace_id" });
  }

  async function updateBrand(field: string, value: string) {
    await supabase
      .from("workspace_brand")
      .upsert({ workspace_id: workspaceId, [field]: value }, { onConflict: "workspace_id" });
  }

  const profile = adnData.profile;
  const market = adnData.market;
  const brand = adnData.brand;

  const profileComplete = !!(
    profile?.business_description && profile?.brand_persona &&
    profile?.avatar_description && profile?.target_audience && profile?.main_offer
  );
  const marketComplete = !!(market?.industry_state && market?.differentiator);
  const brandComplete = !!(brand?.why_clients_choose && brand?.niche_language);

  return (
    <div className="space-y-4">
      {/* Perfil de marca */}
      <Section title="Perfil de Marca" complete={profileComplete}>
        <EditableField
          label="Descripción del negocio"
          value={profile?.business_description ?? null}
          onSave={(v) => updateProfile("business_description", v)}
          multiline
          placeholder="¿Qué hacés y a quién ayudás?"
        />
        <EditableField
          label="Persona de marca"
          value={profile?.brand_persona ?? null}
          onSave={(v) => updateProfile("brand_persona", v)}
          multiline
          placeholder="¿Cómo es la voz y tono de tu marca?"
        />
        <EditableField
          label="Avatar del cliente ideal"
          value={profile?.avatar_description ?? null}
          onSave={(v) => updateProfile("avatar_description", v)}
          multiline
          placeholder="¿Quién es tu cliente ideal? Describilo en detalle."
        />
        <EditableField
          label="Oferta principal"
          value={profile?.main_offer ?? null}
          onSave={(v) => updateProfile("main_offer", v)}
          placeholder="¿Qué producto o servicio principal vendés?"
        />
        <EditableField
          label="Audiencia objetivo"
          value={profile?.target_audience ?? null}
          onSave={(v) => updateProfile("target_audience", v)}
          placeholder="¿A quién va dirigido tu contenido?"
        />
      </Section>

      {/* Estrategia de plataformas */}
      <Section title="Estrategia de Plataformas" complete={adnData.strategies.length > 0}>
        {adnData.strategies.length > 0 ? (
          adnData.strategies.map((s, i) => (
            <div key={i} className="rounded-lg p-4 space-y-2 bg-white/[0.025] border border-white/[0.06]">
              <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">{s.platform}</p>
              {s.current_strategy && (
                <p className="text-[13px] text-white/60 font-light leading-relaxed">{s.current_strategy}</p>
              )}
              {s.formats_and_quantity && (
                <p className="text-[12px] text-white/35 font-light">{s.formats_and_quantity}</p>
              )}
            </div>
          ))
        ) : (
          <p className="text-[13px] text-white/20 font-light italic py-2">
            Sin estrategias cargadas. Completá el chat de ADN para agregarlas.
          </p>
        )}
        <a
          href="/onboarding/adn"
          className="inline-flex items-center gap-1.5 text-[12px] text-white/25 hover:text-white/50 transition-colors"
        >
          Completar con Moka AI →
        </a>
      </Section>

      {/* Mercado y competencia */}
      <Section title="Mercado y Competencia" complete={marketComplete}>
        <EditableField
          label="Estado del mercado"
          value={market?.industry_state ?? null}
          onSave={(v) => updateMarket("industry_state", v)}
          multiline
          placeholder="¿Cómo está el mercado en tu industria?"
        />
        <EditableField
          label="Diferenciador"
          value={market?.differentiator ?? null}
          onSave={(v) => updateMarket("differentiator", v)}
          multiline
          placeholder="¿Qué te diferencia de la competencia?"
        />
        <EditableField
          label="Creencias del mercado"
          value={market?.market_beliefs ?? null}
          onSave={(v) => updateMarket("market_beliefs", v)}
          multiline
          placeholder="¿Qué cree tu audiencia sobre tu industria?"
        />
        <EditableField
          label="Temas quemados"
          value={market?.burned_topics ?? null}
          onSave={(v) => updateMarket("burned_topics", v)}
          multiline
          placeholder="¿Qué temas ya no funcionan en tu nicho?"
        />
        <EditableField
          label="Tendencias actuales"
          value={market?.current_trends ?? null}
          onSave={(v) => updateMarket("current_trends", v)}
          placeholder="¿Qué tendencias están funcionando ahora?"
        />
      </Section>

      {/* Marca y lenguaje */}
      <Section title="Marca y Lenguaje" complete={brandComplete}>
        <EditableField
          label="Por qué te eligen"
          value={brand?.why_clients_choose ?? null}
          onSave={(v) => updateBrand("why_clients_choose", v)}
          multiline
          placeholder="¿Por qué tus clientes te eligen a vos sobre la competencia?"
        />
        <EditableField
          label="Lenguaje del nicho"
          value={brand?.niche_language ?? null}
          onSave={(v) => updateBrand("niche_language", v)}
          multiline
          placeholder="Palabras y frases específicas de tu comunidad"
        />
        <EditableField
          label="Herramientas del nicho"
          value={brand?.niche_tools ?? null}
          onSave={(v) => updateBrand("niche_tools", v)}
          placeholder="¿Qué herramientas usa tu audiencia?"
        />
        <EditableField
          label="Palabras filtro"
          value={brand?.filtering_words ?? null}
          onSave={(v) => updateBrand("filtering_words", v)}
          placeholder="Palabras que usás para atraer o repeler a tu audiencia"
        />
        <EditableField
          label="Nuevos mecanismos"
          value={brand?.new_mechanisms ?? null}
          onSave={(v) => updateBrand("new_mechanisms", v)}
          multiline
          placeholder="¿Qué enfoque nuevo o único tenés?"
        />
      </Section>

      {/* Competidores */}
      <Section title="Competidores" complete={adnData.competitors.length > 0}>
        {adnData.competitors.length > 0 ? (
          <div className="space-y-3">
            {adnData.competitors.map((c, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg p-3 bg-white/[0.025] border border-white/[0.06]">
                <div className="h-8 w-8 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0 text-[12px] text-white/40 font-light">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-white/70 font-light">{c.name || "—"}</p>
                  {c.ig_url && <p className="text-[11px] text-white/30 font-light">{c.ig_url}</p>}
                  {c.why_better && <p className="text-[12px] text-white/40 font-light mt-1">{c.why_better}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-white/20 font-light italic py-2">Sin competidores cargados.</p>
        )}
        <a
          href="/onboarding/adn"
          className="inline-flex items-center gap-1.5 text-[12px] text-white/25 hover:text-white/50 transition-colors"
        >
          Agregar competidores con Moka AI →
        </a>
      </Section>

      {/* Referencias */}
      <Section title="Referencias de Marca" complete={adnData.references.length > 0}>
        {adnData.references.length > 0 ? (
          <div className="space-y-3">
            {adnData.references.map((r, i) => (
              <div key={i} className="rounded-lg p-3 bg-white/[0.025] border border-white/[0.06]">
                <p className="text-[13px] text-white/70 font-light">{r.brand_name || "—"}</p>
                {r.brand_url && <p className="text-[11px] text-white/30 font-light">{r.brand_url}</p>}
                {r.what_they_like && <p className="text-[12px] text-white/40 font-light mt-1">{r.what_they_like}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-white/20 font-light italic py-2">Sin referencias cargadas.</p>
        )}
      </Section>
    </div>
  );
}
