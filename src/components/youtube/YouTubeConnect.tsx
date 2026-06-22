"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Youtube, Loader2, LinkIcon } from "lucide-react";

interface YouTubeConnectProps {
  workspaceId: string;
}

export function YouTubeConnect({ workspaceId }: YouTubeConnectProps) {
  const t = useTranslations("youtubeDeep");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/google/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      const data = await res.json();
      if (data.data?.oauth_url) {
        window.location.href = data.data.oauth_url;
      } else {
        setError(t("connect.errors.cantStart"));
      }
    } catch {
      setError(t("connect.errors.connection"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="h-20 w-20 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: "rgba(255,0,0,0.08)", border: "1px solid rgba(255,0,0,0.15)" }}
      >
        <Youtube className="h-10 w-10 text-red-500/70" />
      </div>

      <h2 className="text-[22px] font-extralight text-foreground tracking-[-0.02em] mb-2">
        {t("connect.title")}
      </h2>
      <p className="text-[14px] text-muted-foreground max-w-md mb-8">
        {t("connect.body")}
      </p>

      <button
        onClick={handleConnect}
        disabled={loading}
        className="flex items-center gap-3 px-6 py-3 rounded-xl text-[14px] font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
        style={{
          background: "rgba(255,0,0,0.12)",
          border: "1px solid rgba(255,0,0,0.25)",
          color: "#ff4444",
        }}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <LinkIcon className="h-5 w-5" />
        )}
        {loading ? t("connect.connecting") : t("connect.connectWithGoogle")}
      </button>

      {error && (
        <p className="mt-4 text-[12px] text-red-400/70">{error}</p>
      )}

      <p className="mt-6 text-[11px] text-muted-foreground max-w-sm">
        {t("connect.footnote")}
      </p>
    </div>
  );
}
