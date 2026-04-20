"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

interface DmTrackingControlsProps {
  metaConnectionId: string;
  initialEnabled: boolean;
  lastEventLabel: string | null;
}

/**
 * Single-row interactive controls for the DM tracking section on the
 * /settings/integrations page. Owns the toggle (enable/disable) and the
 * "Eliminar historial de DMs" action. Server-rendered state is hydrated
 * via `initialEnabled` and kept in sync by calling `router.refresh()` on
 * success so cards above (e.g. "Último evento") reflect the change.
 */
export function DmTrackingControls({
  metaConnectionId,
  initialEnabled,
  lastEventLabel,
}: DmTrackingControlsProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleToggle() {
    const nextAction: "enable" | "disable" = enabled ? "disable" : "enable";
    setToggleLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/settings/dm-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: nextAction, meta_connection_id: metaConnectionId }),
      });
      const json = (await res.json()) as { data?: { webhook_subscribed?: boolean }; message?: string };

      if (!res.ok) {
        throw new Error(json?.message || "No pudimos actualizar el seguimiento de DMs.");
      }

      setEnabled(json.data?.webhook_subscribed ?? nextAction === "enable");
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos actualizar el seguimiento de DMs.");
    } finally {
      setToggleLoading(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Esto eliminará todos los eventos de DMs de los últimos 90 días. La acción no se puede deshacer."
    );
    if (!confirmed) return;

    setDeleteLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/settings/dm-tracking/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta_connection_id: metaConnectionId }),
      });
      const json = (await res.json()) as {
        data?: { events_deleted?: number; daily_rows_deleted?: number };
        message?: string;
      };

      if (!res.ok) {
        throw new Error(json?.message || "No pudimos eliminar el historial.");
      }

      const events = json.data?.events_deleted ?? 0;
      setNotice(`Eliminamos ${events} eventos de DMs de tu historial.`);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos eliminar el historial.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-foreground">DM tracking</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recibimos eventos cuando alguien te escribe o abre una nueva conversación.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={toggleLoading}
          aria-pressed={enabled}
          aria-label={enabled ? "Desactivar DM tracking" : "Activar DM tracking"}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            enabled
              ? "bg-emerald-500/30 border-emerald-500/40"
              : "bg-white/[0.06] border-white/[0.10]"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
          {toggleLoading ? (
            <Loader2 className="absolute inset-0 m-auto h-3 w-3 animate-spin text-white/80" />
          ) : null}
        </button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Último evento</p>
          <p className="text-xs text-muted-foreground mt-0.5">{lastEventLabel ?? "Sin eventos aún"}</p>
        </div>
      </div>

      <div className="pt-3 border-t border-white/[0.06]">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Acciones</p>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteLoading}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-xs font-light text-red-300 transition-all hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {deleteLoading ? "Eliminando..." : "Eliminar historial de DMs"}
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-400/15 bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-400/15 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
