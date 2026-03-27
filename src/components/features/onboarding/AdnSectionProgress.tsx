"use client";

import type { AdnProgress } from "@/services/adn-progress.service";

interface AdnSectionProgressProps {
  progress: AdnProgress;
}

const sections = [
  {
    number: 1,
    title: "Documentos Base",
    keys: ["profile"] as const,
    totalFields: 5, // business_description, brand_persona, avatar_description, target_audience, main_offer
  },
  {
    number: 2,
    title: "Redes Sociales",
    keys: ["strategies"] as const,
    totalFields: 2, // instagram + youtube platforms
  },
  {
    number: 3,
    title: "Competidores",
    keys: ["market", "competitors"] as const,
    totalFields: 8, // 7 market fields + 1 competitor min
  },
  {
    number: 4,
    title: "Tu Marca",
    keys: ["brand", "references"] as const,
    totalFields: 6, // 5 brand fields + 1 reference min
  },
];

function getSectionFieldCount(
  progress: AdnProgress,
  keys: readonly string[]
): number {
  let count = 0;
  for (const k of keys) {
    const section = progress.sections[k as keyof typeof progress.sections];
    if ("fields_filled" in section) {
      count += section.fields_filled.length;
    } else if ("platforms" in section) {
      count += section.platforms.length;
    } else if ("count" in section) {
      count += Math.min(section.count, 1); // cap at 1 for percentage calc
    }
  }
  return count;
}

function isSectionComplete(
  progress: AdnProgress,
  keys: readonly string[]
): boolean {
  return keys.every(
    (k) => progress.sections[k as keyof typeof progress.sections].complete
  );
}

function isSectionActive(progress: AdnProgress, sectionNumber: number): boolean {
  return progress.current_section === sectionNumber;
}

export function AdnSectionProgress({ progress }: AdnSectionProgressProps) {
  // Calculate overall % from all fields
  const totalPossible = sections.reduce((sum, s) => sum + s.totalFields, 0); // 21
  const totalFilled = sections.reduce(
    (sum, s) => sum + Math.min(getSectionFieldCount(progress, s.keys), s.totalFields),
    0
  );
  const percent = Math.round((totalFilled / totalPossible) * 100);

  return (
    <div className="flex flex-col h-full">
      {/* Progress % */}
      <div className="mb-5">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[11px] font-medium text-white/35 tracking-[0.06em] uppercase">
            Progreso
          </p>
          <p className="text-[20px] font-light text-white/80 tracking-[-0.02em]">
            {percent}%
          </p>
        </div>
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${percent}%`,
              background:
                "linear-gradient(90deg, rgba(52,211,153,0.5) 0%, rgba(52,211,153,0.9) 100%)",
              boxShadow: percent > 0 ? "0 0 8px rgba(52,211,153,0.3)" : "none",
            }}
          />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-1 flex-1">
        {sections.map((section) => {
          const complete = isSectionComplete(progress, section.keys);
          const active = isSectionActive(progress, section.number);

          return (
            <div
              key={section.number}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all duration-300 ${
                active
                  ? "bg-white/[0.05]"
                  : ""
              }`}
            >
              {/* Icon */}
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
                  section.number
                )}
              </div>

              {/* Title */}
              <p
                className={`text-[12px] transition-colors duration-300 ${
                  active
                    ? "font-medium text-white/80"
                    : complete
                    ? "font-light text-white/45"
                    : "font-light text-white/20"
                }`}
              >
                {section.title}
              </p>

              {/* Active dot */}
              {active && !complete && (
                <div className="ml-auto shrink-0 h-1.5 w-1.5 rounded-full bg-white/40 animate-pulse" />
              )}
            </div>
          );
        })}
      </div>

      {/* Hint */}
      <div className="mt-4 pt-3 border-t border-white/[0.04]">
        <p className="text-[10px] text-white/15 font-light leading-relaxed">
          Podés pausar y retomar cuando quieras.
        </p>
      </div>
    </div>
  );
}
