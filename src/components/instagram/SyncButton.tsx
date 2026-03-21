"use client";

import { useState } from "react";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";

interface SyncButtonProps {
  workspaceId: string;
  currentTab?: string;
}

export function SyncButton({ workspaceId, currentTab }: SyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    status: string;
    reels_synced?: number;
    insights_fetched?: number;
    errors?: string[];
  } | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);

    try {
      const stepsParam = currentTab === 'metrics' ? '&steps=account' : '';
      const res = await fetch(
        `/api/v1/sync/instagram?workspace_id=${workspaceId}${stepsParam}`,
        { method: "POST" }
      );
      const json = await res.json();
      const responseErrors = json.data?.errors || json.errors || [];

      if (!res.ok) {
        setResult({ status: "error", errors: [json.message || "Error desconocido"] });
      } else if (json.data?.status === "failed") {
        setResult({ status: "error", errors: responseErrors.length > 0 ? responseErrors : ["La sincronización falló"] });
      } else {
        setResult(json.data);
        if (json.data?.status === "completed") {
          window.location.reload();
        }
      }
    } catch {
      setResult({ status: "error", errors: ["Error de red"] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center gap-1.5 text-[13px] font-medium text-white/70 hover:text-white px-3 py-1.5 rounded-md transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.05)" }}
      >
        <ArrowsClockwiseIcon size={14} className={loading ? "animate-spin" : ""} />
        {loading ? "Sincronizando..." : "Sincronizar"}
      </button>
      {result?.status === "error" && result.errors?.[0] && (
        <span className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded">
          {result.errors[0]}
        </span>
      )}
    </div>
  );
}
