"use client";

import { useState, useCallback } from "react";
import { RefreshCw, Check, AlertCircle } from "lucide-react";

interface SyncButtonProps {
  workspaceId: string;
  currentTab?: string;
}

type SyncPhase = "idle" | "quick" | "done" | "error";

export function SyncButton({ workspaceId, currentTab }: SyncButtonProps) {
  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        setErrorMsg(quickJson.data?.error || quickJson.message || "Error en sync rápido");
        return;
      }

      // Quick done — reload to show fresh data, fire full sync after
      if (stepsParam === "account") {
        window.location.reload();
        return;
      }

      // Fire full sync in background BEFORE reload (fire-and-forget)
      fetch(
        `/api/v1/sync/instagram?workspace_id=${workspaceId}&steps=all`,
        { method: "POST" }
      ).catch(() => { /* background, non-blocking */ });

      window.location.reload();
    } catch {
      setPhase("error");
      setErrorMsg("Error de red");
    }
  }, [workspaceId, currentTab]);

  const isLoading = phase === "quick";

  const label = {
    idle: "Sincronizar",
    quick: "Actualizando...",
    done: "Listo",
    error: "Sincronizar",
  }[phase];

  const Icon = phase === "done" ? Check : phase === "error" ? AlertCircle : RefreshCw;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={isLoading}
        className="flex items-center gap-1.5 text-[13px] font-medium text-white/70 hover:text-white px-3 py-1.5 rounded-md transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.05)" }}
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
