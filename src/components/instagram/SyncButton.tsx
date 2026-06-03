"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RefreshCw, Check, AlertCircle } from "lucide-react";

interface SyncButtonProps {
  workspaceId: string;
  currentTab?: string;
}

type SyncPhase = "idle" | "quick" | "done" | "error";

export function SyncButton({ workspaceId, currentTab }: SyncButtonProps) {
  const router = useRouter();
  const t = useTranslations("igAdvanced");
  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSync = useCallback(async () => {
    setPhase("quick");
    setErrorMsg(null);

    try {
      // 1. QUICK = recompensa rápida: trae los primeros ~12 reels (o el account
      //    en la vista de métricas) + sus métricas (~3-5s). Apenas vuelve, pinta
      //    la primera página y marca "Listo". Feedback en segundos.
      const stepsParam = currentTab === "metrics" ? "account" : "quick";
      const res = await fetch(
        `/api/v1/sync/instagram?workspace_id=${workspaceId}&steps=${stepsParam}`,
        { method: "POST" }
      );
      const json = await res.json();

      if (!res.ok || json.error === "TOKEN_EXPIRED" || json.data?.status === "error") {
        setPhase("error");
        setErrorMsg(
          json.error === "TOKEN_EXPIRED"
            ? t("sync.tokenExpired")
            : (json.message || json.data?.error || t("sync.quickError"))
        );
        return;
      }

      // Pinta la primera página + "Listo" YA.
      router.refresh();
      setPhase("done");

      // 2. El RESTO en segundo plano (todos los reels + account + stories, y ads
      //    ÚLTIMO). Fire-and-forget: no esperamos, no trackeamos, no refrescamos
      //    en loop (eso era lo que generaba ~228 requests). Lo que sincroniza
      //    aparece en la próxima carga/navegación.
      const first = currentTab === "metrics" ? "account" : "reels";
      fetch(
        `/api/v1/sync/instagram?workspace_id=${workspaceId}&steps=all&first=${first}`,
        { method: "POST" }
      ).catch(() => { /* background, non-blocking */ });
    } catch {
      setPhase("error");
      setErrorMsg(t("sync.networkError"));
    }
  }, [workspaceId, currentTab, router, t]);

  const isLoading = phase === "quick";

  const label = {
    idle: t("sync.button.idle"),
    quick: t("sync.button.quick"),
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
