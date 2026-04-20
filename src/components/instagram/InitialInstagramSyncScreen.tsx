"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, Instagram, Loader2, RefreshCw, Sparkles } from "lucide-react";

interface InitialInstagramSyncScreenProps {
  igUsername: string | null;
  workspaceId: string;
}

type SyncPhase = {
  title: string;
  description: string;
};

const PHASES: SyncPhase[] = [
  {
    title: "Validando la conexión",
    description: "Verificamos permisos, cuenta de Instagram Business y acceso al workspace.",
  },
  {
    title: "Descargando tus contenidos",
    description: "Estamos trayendo tus Reels de los últimos 90 días.",
  },
  {
    title: "Procesando métricas y Ads",
    description: "Consolidamos alcance, views, engagement y atribución paga cuando existe.",
  },
  {
    title: "Armando tu dashboard",
    description: "Calculamos benchmarks, ordenamos la data y dejamos todo listo para explorar.",
  },
];

export function InitialInstagramSyncScreen({ igUsername, workspaceId }: InitialInstagramSyncScreenProps) {
  const router = useRouter();
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSyncing, setIsSyncing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const progress = useMemo(() => {
    const baseProgress = ((phaseIndex + 1) / PHASES.length) * 100;
    return Math.max(8, Math.min(92, baseProgress));
  }, [phaseIndex]);

  useEffect(() => {
    const phaseTimer = window.setInterval(() => {
      setPhaseIndex((current) => (current < PHASES.length - 1 ? current + 1 : current));
    }, 4500);

    const elapsedTimer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => {
      window.clearInterval(phaseTimer);
      window.clearInterval(elapsedTimer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function runInitialSync() {
      setIsSyncing(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/sync/instagram?workspace_id=${workspaceId}`, {
          method: "POST",
        });
        const json = await response.json();
        const responseError = json?.message || json?.error || json?.data?.errors?.[0] || "No pudimos completar la sincronización inicial.";

        if (!response.ok || json?.data?.status === "failed") {
          throw new Error(responseError);
        }

        if (cancelled) {
          return;
        }

        setPhaseIndex(PHASES.length - 1);
        window.dispatchEvent(new Event("nav:start"));
        router.replace("/instagram");
        router.refresh();
      } catch (syncError) {
        if (cancelled) {
          return;
        }

        setError(syncError instanceof Error ? syncError.message : "No pudimos completar la sincronización inicial.");
        setIsSyncing(false);
      }
    }

    void runInitialSync();

    return () => {
      cancelled = true;
    };
  }, [router, workspaceId]);

  const currentPhase = PHASES[phaseIndex];

  return (
    <div className="px-8 py-10 h-full">
      <div className="mx-auto flex min-h-[calc(100vh-180px)] max-w-5xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="glass-section rounded-[28px] p-10">
            <div className="mb-8 inline-flex h-16 w-16 items-center justify-center rounded-xl border border-pink-500/30 bg-gradient-to-br from-pink-500/20 to-purple-500/20">
              <Instagram className="h-8 w-8 text-pink-400" />
            </div>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-white/45">
                <Sparkles className="h-3.5 w-3.5" />
                Primera sincronización
              </div>

              <div>
                <h1 className="page-title text-[2.6rem] leading-none tracking-[-0.05em]">
                  Estamos preparando tu
                  <span className="block bg-gradient-to-r from-white to-white/55 bg-clip-text text-transparent">
                    Instagram Intelligence
                  </span>
                </h1>
                <p className="mt-4 max-w-2xl text-[15px] font-light text-white/45">
                  {igUsername
                    ? `Conectamos la cuenta @${igUsername}. Ahora estamos trayendo y procesando tu información para que entres con data real desde el primer minuto.`
                    : "Acabás de conectar tu cuenta. Ahora estamos trayendo y procesando tu información para que entres con data real desde el primer minuto."}
                </p>
              </div>
            </div>

            <div className="mt-10 rounded-[24px] border border-white/[0.1] bg-white/[0.03] p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/35">Etapa actual</p>
                  <h2 className="mt-2 text-[24px] font-extralight tracking-[-0.03em] text-white">{currentPhase.title}</h2>
                </div>
                <div className="flex items-center gap-3 rounded-full border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm text-white/65">
                  <Loader2 className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? "Sincronizando" : "Pausada"}
                </div>
              </div>

              <p className="text-sm font-light leading-relaxed text-white/45">{currentPhase.description}</p>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-[12px] text-white/35">
                  <span>Progreso estimado</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {PHASES.map((phase, index) => {
                const isDone = index < phaseIndex;
                const isCurrent = index === phaseIndex;

                return (
                  <div
                    key={phase.title}
                    className={`rounded-xl border p-4 transition-all ${
                      isCurrent
                        ? "border-violet-400/30 bg-violet-400/10"
                        : "border-white/8 bg-white/[0.025]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ${
                          isDone ? "bg-emerald-400/15 text-emerald-300" : isCurrent ? "bg-violet-400/15 text-violet-300" : "bg-white/[0.05] text-white/35"
                        }`}
                      >
                        {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{phase.title}</p>
                        <p className="mt-1 text-[12px] leading-relaxed text-white/40">{phase.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="glass-card rounded-[28px] p-7">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/35">Tiempo transcurrido</p>
              <p className="mt-3 text-[42px] font-extralight tracking-[-0.04em] text-white">{elapsedSeconds}s</p>
              <p className="mt-3 text-sm font-light leading-relaxed text-white/40">
                La primera sincronización suele tardar más porque trae contenido histórico, métricas de cuenta y benchmarks base.
              </p>
            </div>

            <div className="glass-card rounded-[28px] p-7">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/35">Qué vas a ver al entrar</p>
              <div className="mt-4 space-y-3 text-sm font-light text-white/55">
                <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">Tus Reels recientes</div>
                <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">KPIs orgánicos y pagados</div>
                <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">Benchmark inicial de 90 días</div>
                <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">IG Metrics a nivel de cuenta</div>
              </div>
            </div>

            {error ? (
              <div className="rounded-[28px] border border-red-500/20 bg-red-500/5 p-7">
                <p className="text-[11px] uppercase tracking-[0.12em] text-red-300/70">Sincronización interrumpida</p>
                <p className="mt-3 text-sm leading-relaxed text-red-200">{error}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.06] px-4 py-2 text-sm text-white transition-all hover:bg-white/[0.1]"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reintentar sincronización
                  </button>
                  <Link
                    href="/onboarding"
                    className="inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-red-200 transition-all hover:bg-red-400/15"
                  >
                    Revisar conexión
                  </Link>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
