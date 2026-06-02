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
      // 1. Check rápido (~1-2s): valida token/conexión. Antes el botón esperaba
      //    el "quick sync" entero (a veces ~30s); ahora solo valida y dispara el
      //    sync de fondo, sin bloquear.
      const checkRes = await fetch(
        `/api/v1/sync/instagram?workspace_id=${workspaceId}&steps=check`,
        { method: "POST" }
      );
      const checkJson = await checkRes.json();

      if (!checkRes.ok || checkJson.error === "TOKEN_EXPIRED" || checkJson.data?.status === "error") {
        setPhase("error");
        if (checkJson.error === "TOKEN_EXPIRED") {
          setErrorMsg(t("sync.tokenExpired"));
        } else {
          setErrorMsg(checkJson.message || checkJson.data?.error || t("sync.quickError"));
        }
        return;
      }

      // 2. Full sync en background, ORDENADO según la vista: reels-first en la
      //    pestaña de reels (el edge los streamea por página → los más nuevos
      //    aparecen primero), account-first en métricas. La página ya muestra los
      //    reels actuales; el useEffect refresca cada 4s y los nuevos van llegando
      //    solos. No se bloquea esperando nada.
      const first = currentTab === "metrics" ? "account" : "reels";
      fetch(
        `/api/v1/sync/instagram?workspace_id=${workspaceId}&steps=all&first=${first}`,
        { method: "POST" }
      ).catch(() => { /* background, non-blocking */ });

      setPhase("syncing");
      startTracking();
    } catch {
      setPhase("error");
      setErrorMsg(t("sync.networkError"));
    }
  }, [workspaceId, currentTab, t, startTracking]);

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
