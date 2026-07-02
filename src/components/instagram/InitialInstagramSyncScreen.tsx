"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, ChevronRight, Instagram, Loader2, RefreshCw, Sparkles } from "lucide-react";

interface InitialInstagramSyncScreenProps {
  igUsername: string | null;
  workspaceId: string;
}

type SyncPhase = {
  title: string;
  description: string;
};

export function InitialInstagramSyncScreen({ igUsername, workspaceId }: InitialInstagramSyncScreenProps) {
  const router = useRouter();
  const t = useTranslations("igAdvanced");
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSyncing, setIsSyncing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PHASES: SyncPhase[] = useMemo(() => [
    {
      title: t("initialSync.phases.validate.title"),
      description: t("initialSync.phases.validate.description"),
    },
    {
      title: t("initialSync.phases.download.title"),
      description: t("initialSync.phases.download.description"),
    },
    {
      title: t("initialSync.phases.metrics.title"),
      description: t("initialSync.phases.metrics.description"),
    },
    {
      title: t("initialSync.phases.dashboard.title"),
      description: t("initialSync.phases.dashboard.description"),
    },
  ], [t]);

  const progress = useMemo(() => {
    const baseProgress = ((phaseIndex + 1) / PHASES.length) * 100;
    return Math.max(8, Math.min(92, baseProgress));
  }, [phaseIndex]);

  useEffect(() => {
    // Timer COSMÉTICO: solo avanza las 2 primeras fases (validar → descargar).
    // Las fases 3-4 las marca el polling con señales REALES de sync_jobs.
    // Antes el timer subía hasta la última fase (92%) y el polling la bajaba
    // a la real (75%) → el porcentaje rebotaba 75 → 92 → 75 en loop.
    const phaseTimer = window.setInterval(() => {
      setPhaseIndex((current) => (current < 1 ? current + 1 : current));
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
        // El endpoint ahora responde 202 inmediato y corre el sync en background
        // (fix del 504 + chain de 3 invocaciones). No podemos esperar la
        // response como antes — tenemos que pollear sync_jobs para saber cuándo
        // los steps críticos (account + media) completaron.
        const kickoffStart = Date.now();
        const kickoffRes = await fetch(`/api/v1/sync/instagram?workspace_id=${workspaceId}`, {
          method: "POST",
        });
        const kickoffJson = await kickoffRes.json().catch(() => ({}));

        // Error inmediato (auth, token expirado, etc.) — cortamos.
        if (!kickoffRes.ok && kickoffRes.status !== 202) {
          throw new Error(
            kickoffJson?.message ||
              kickoffJson?.error ||
              t("initialSync.errors.kickoff")
          );
        }

        // Polling hasta que account_insights + full_sync completen.
        // Timeout de 5 min como safety.
        const TIMEOUT_MS = 5 * 60 * 1000;
        const POLL_INTERVAL_MS = 3000;
        const startedAt = kickoffStart;

        while (!cancelled) {
          if (Date.now() - startedAt > TIMEOUT_MS) {
            throw new Error(
              t("initialSync.errors.timeout")
            );
          }

          const statusRes = await fetch(
            `/api/v1/sync/status?workspace_id=${workspaceId}`
          );
          if (!statusRes.ok) {
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
            continue;
          }
          const statusJson = await statusRes.json();
          const jobs = Array.isArray(statusJson?.data) ? statusJson.data : [];

          // Sólo consideramos jobs iniciados DESPUÉS del kickoff (con 10s de
          // margen) para ignorar jobs viejos que puedan estar running/orphan.
          const relevant = jobs.filter(
            (j: { started_at: string }) =>
              new Date(j.started_at).getTime() >= startedAt - 10_000
          );

          const findJob = (type: string) =>
            relevant.find((j: { job_type: string }) => j.job_type === type);

          const accountJob = findJob("account_insights");
          const mediaJob = findJob("full_sync");
          const storiesJob = findJob("stories_sync");

          // Fase 2 = "Descargando contenidos" (cuando account está por terminar)
          // Fase 3 = "Procesando métricas y Ads" (cuando account completó y media arrancó)
          // Fase 4 = "Armando dashboard" (cuando media completó)
          // MONOTÓNICO: la fase (y el %) nunca retrocede.
          if (mediaJob?.status === "completed") {
            setPhaseIndex((prev) => Math.max(prev, 3));
          } else if (accountJob?.status === "completed") {
            setPhaseIndex((prev) => Math.max(prev, 2));
          } else if (accountJob?.status === "running" || mediaJob?.status === "running") {
            setPhaseIndex((prev) => Math.max(prev, 1));
          }

          // Account + media listos → el dashboard tiene todo lo esencial.
          // Stories es opcional; no bloqueamos el redirect.
          if (
            accountJob?.status === "completed" &&
            mediaJob?.status === "completed"
          ) {
            if (cancelled) return;

            // Esperamos 1s extra para dar chance a que stories también complete
            // si falta poco. No bloquea si no.
            if (storiesJob && storiesJob.status === "running") {
              await new Promise((r) => setTimeout(r, 1500));
            }

            setPhaseIndex(PHASES.length - 1);
            window.dispatchEvent(new Event("nav:start"));
            router.replace("/instagram");
            router.refresh();
            return;
          }

          // Si alguno falló, cortamos con error.
          if (accountJob?.status === "failed" || mediaJob?.status === "failed") {
            throw new Error(
              t("initialSync.errors.stepFailed")
            );
          }

          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
      } catch (syncError) {
        if (cancelled) {
          return;
        }

        setError(
          syncError instanceof Error
            ? syncError.message
            : t("initialSync.errors.generic")
        );
        setIsSyncing(false);
      }
    }

    void runInitialSync();

    return () => {
      cancelled = true;
    };
  }, [router, workspaceId, t]);

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
                {t("initialSync.badge")}
              </div>

              <div>
                <h1 className="page-title text-[2.6rem] leading-none tracking-[-0.05em]">
                  {t("initialSync.heading.line1")}
                  <span className="block bg-gradient-to-r from-white to-white/55 bg-clip-text text-transparent">
                    {t("initialSync.heading.line2")}
                  </span>
                </h1>
                <p className="mt-4 max-w-2xl text-[15px] font-light text-white/45">
                  {igUsername
                    ? t("initialSync.heading.subWithUsername", { username: igUsername })
                    : t("initialSync.heading.subNoUsername")}
                </p>
              </div>
            </div>

            <div className="mt-10 rounded-[24px] border border-white/[0.1] bg-white/[0.03] p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/35">{t("initialSync.currentStage")}</p>
                  <h2 className="mt-2 text-[24px] font-extralight tracking-[-0.03em] text-white">{currentPhase.title}</h2>
                </div>
                <div className="flex items-center gap-3 rounded-full border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm text-white/65">
                  <Loader2 className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? t("initialSync.statusSyncing") : t("initialSync.statusPaused")}
                </div>
              </div>

              <p className="text-sm font-light leading-relaxed text-white/45">{currentPhase.description}</p>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-[12px] text-white/35">
                  <span>{t("initialSync.estimatedProgress")}</span>
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
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/35">{t("initialSync.elapsedTime")}</p>
              <p className="mt-3 text-[42px] font-extralight tracking-[-0.04em] text-white">{elapsedSeconds}s</p>
              <p className="mt-3 text-sm font-light leading-relaxed text-white/40">
                {t("initialSync.elapsedHint")}
              </p>
            </div>

            <div className="glass-card rounded-[28px] p-7">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/35">{t("initialSync.whatYoullSee.title")}</p>
              <div className="mt-4 space-y-3 text-sm font-light text-white/55">
                <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">{t("initialSync.whatYoullSee.item1")}</div>
                <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">{t("initialSync.whatYoullSee.item2")}</div>
                <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">{t("initialSync.whatYoullSee.item3")}</div>
                <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">{t("initialSync.whatYoullSee.item4")}</div>
              </div>
            </div>

            {error ? (
              <div className="rounded-[28px] border border-red-500/20 bg-red-500/5 p-7">
                <p className="text-[11px] uppercase tracking-[0.12em] text-red-300/70">{t("initialSync.errorTitle")}</p>
                <p className="mt-3 text-sm leading-relaxed text-red-200">{error}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.06] px-4 py-2 text-sm text-white transition-all hover:bg-white/[0.1]"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {t("initialSync.actions.retry")}
                  </button>
                  <Link
                    href="/onboarding"
                    className="inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-red-200 transition-all hover:bg-red-400/15"
                  >
                    {t("initialSync.actions.checkConnection")}
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
