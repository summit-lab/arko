"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RefreshCw, Check, AlertCircle } from "lucide-react";
import { useSyncJobProgress } from "@/hooks/useSyncJobProgress";

interface SyncButtonProps {
  workspaceId: string;
  currentTab?: string;
}

type SyncPhase = "idle" | "quick" | "syncing" | "done" | "error";

export function SyncButton({ workspaceId, currentTab }: SyncButtonProps) {
  const router = useRouter();
  const t = useTranslations("igAdvanced");
  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { isActive, status, startTracking } = useSyncJobProgress(workspaceId);

  // Mientras el sync de fondo corre, el edge va escribiendo los reels por página
  // (streaming). Refrescamos los server components cada 4s para que esos reels
  // aparezcan solos, dando sensación de carga progresiva.
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [isActive, router]);

  // Al terminar el full sync: refresco final + estado del botón.
  useEffect(() => {
    if (status === "completed") {
      router.refresh();
      setPhase("done");
    } else if (status === "failed") {
      setPhase("error");
    }
  }, [status, router]);

  const handleSync = useCallback(async () => {
    setPhase("quick");
    setErrorMsg(null);

    try {
      // Quick sync — latest 12 reels + insights (~3-5s)
      const stepsParam = currentTab === "metrics" ? "account" : "quick";
      const quickRes = await fetch(
        `/api/v1/sync/instagram?workspace_id=${workspaceId}&steps=${stepsParam}`,
        { method: "POST" }
      );
      const quickJson = await quickRes.json();

      if (!quickRes.ok || quickJson.data?.status === "error") {
        setPhase("error");
        if (quickJson.error === "TOKEN_EXPIRED") {
          setErrorMsg(t("sync.tokenExpired"));
        } else {
          setErrorMsg(quickJson.message || quickJson.data?.error || t("sync.quickError"));
        }
        return;
      }

      // Quick done — mostrar la primera página (los más nuevos) al instante
      router.refresh();

      if (stepsParam === "account") {
        setPhase("done");
        return;
      }

      // Disparar full sync en background y trackearlo: mientras corre, el edge
      // escribe los reels por página y el useEffect de arriba va refrescando.
      fetch(
        `/api/v1/sync/instagram?workspace_id=${workspaceId}&steps=all`,
        { method: "POST" }
      ).catch(() => { /* background, non-blocking */ });

      setPhase("syncing");
      startTracking();
    } catch {
      setPhase("error");
      setErrorMsg(t("sync.networkError"));
    }
  }, [workspaceId, currentTab, router, t, startTracking]);

  const isLoading = phase === "quick" || phase === "syncing";

  const label = {
    idle: t("sync.button.idle"),
    quick: t("sync.button.quick"),
    syncing: t("sync.button.quick"),
    done: t("sync.button.done"),
    error: t("sync.button.idle"),
  }[phase];

  const Icon = phase === "done" ? Check : phase === "error" ? AlertCircle : RefreshCw;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={isLoading}
        className="flex items-center gap-1.5 text-[13px] font-medium text-white/70 hover:text-white px-3 py-1.5 rounded-md transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-transparent border border-white/[0.06]"
      >
        <Icon size={14} strokeWidth={2} className={isLoading ? "animate-spin" : ""} />
        {label}
      </button>
      {phase === "error" && errorMsg && (
        <span className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
