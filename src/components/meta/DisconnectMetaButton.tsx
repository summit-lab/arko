"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Unplug } from "lucide-react";

interface DisconnectMetaButtonProps {
  workspaceId: string;
}

export function DisconnectMetaButton({ workspaceId }: DisconnectMetaButtonProps) {
  const router = useRouter();
  const t = useTranslations("settings.meta");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    const confirmed = window.confirm(t("disconnectConfirm"));

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/auth/meta/disconnect?workspace_id=${workspaceId}`, {
        method: "POST",
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.message || t("disconnectError"));
      }

      router.refresh();
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : t("disconnectError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleDisconnect}
        disabled={loading}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-light text-red-200 transition-all hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
        {loading ? t("disconnecting") : t("disconnect")}
      </button>
      {error ? (
        <p className="rounded-full border border-red-400/15 bg-red-400/10 px-3 py-1 text-xs text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
