"use client";

import { Users } from "lucide-react";

interface AdnMessageProps {
  role: "user" | "assistant";
  content: string;
  onCompetitorFormClick?: () => void;
  competitorCount?: number;
}

const COMPETITOR_MARKER = "{{COMPETITOR_FORM}}";

export function AdnMessage({ role, content, onCompetitorFormClick, competitorCount }: AdnMessageProps) {
  const isUser = role === "user";
  const hasCompetitorForm = !isUser && content.includes(COMPETITOR_MARKER);

  // Split content around the marker
  const parts = hasCompetitorForm ? content.split(COMPETITOR_MARKER) : [content];

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-6 py-3.5 text-[13.5px] leading-relaxed ${
          isUser
            ? "bg-white/[0.07] border border-white/[0.06] text-white/75"
            : "glass-card text-white/65"
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-2">
            <div className="h-4 w-4 rounded-full bg-gradient-to-b from-white/12 to-white/4 flex items-center justify-center">
              <svg width="9" height="9" viewBox="0 0 607.13 523.93" xmlns="http://www.w3.org/2000/svg">
                <path fill="rgba(255,255,255,0.5)" d="M412.55,17.53c-4.06-10.56-14.2-17.53-25.51-17.53h-185.69l-.23.57,79.73,207.46s0,.05.02.09c.66,3.31,4.16,22.81-8.98,40.42-12.23,16.41-30.03,19.33-33.45,19.83h-121.46c-11.31,0-21.46,6.97-25.51,17.53L0,523.93h204.93l77.56-201.82c3.56-7.38,11.97-22.46,28.68-35.1,1.71-1.33,3.54-2.61,5.44-3.84,16-10.42,31.4-13.64,40.08-14.78h152.26L412.55,17.53Z"/>
                <path fill="rgba(255,255,255,0.5)" d="M607.13,523.93h-204.93l-23.47-61.08c-18.53-49.04,6.47-104.64,55.35-123.28,48.72-18.58,104.22,5.99,123.21,54.68l49.84,129.68Z"/>
              </svg>
            </div>
            <span className="text-[10px] font-medium text-white/30 tracking-wide">Arko</span>
          </div>
        )}

        {hasCompetitorForm ? (
          <div className="space-y-3">
            {/* Text before marker */}
            {parts[0] && parts[0].trim() && (
              <div className="whitespace-pre-wrap font-light">
                {renderBoldText(parts[0].trim())}
              </div>
            )}

            {/* Competitor form card */}
            <CompetitorFormCard
              onClick={onCompetitorFormClick}
              competitorCount={competitorCount ?? 0}
            />

            {/* Text after marker */}
            {parts[1] && parts[1].trim() && (
              <div className="whitespace-pre-wrap font-light">
                {renderBoldText(parts[1].trim())}
              </div>
            )}
          </div>
        ) : (
          <div className="whitespace-pre-wrap font-light">
            {renderBoldText(content)}
          </div>
        )}
      </div>
    </div>
  );
}

function renderBoldText(text: string) {
  return text.split(/\*\*(.*?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-white/85">{part}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function CompetitorFormCard({
  onClick,
  competitorCount,
}: {
  onClick?: () => void;
  competitorCount: number;
}) {
  const hasSaved = competitorCount > 0;

  return (
    <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.04] p-4 my-2">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
          <Users size={16} className="text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-light text-white/70">
            {hasSaved
              ? `${competitorCount} competidor${competitorCount !== 1 ? "es" : ""} cargado${competitorCount !== 1 ? "s" : ""}`
              : "Cargá tus competidores principales"}
          </p>
          <p className="text-[11px] text-white/30 font-light mt-0.5">
            {hasSaved
              ? "Podés editarlos en cualquier momento"
              : "Nombre, Instagram y qué te gusta de ellos"}
          </p>
        </div>
        <button
          onClick={onClick}
          className="shrink-0 px-4 py-2 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-[12px] font-medium text-violet-300 hover:text-violet-200 transition-all cursor-pointer"
        >
          {hasSaved ? "Editar" : "Agregar competidores"}
        </button>
      </div>
    </div>
  );
}
