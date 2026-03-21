"use client";

import { useState } from "react";
import { Instagram, ArrowRight, Loader2 } from "lucide-react";

interface ConnectMetaButtonProps {
  workspaceId: string;
}

export function ConnectMetaButton({ workspaceId }: ConnectMetaButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/auth/meta/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setError(json.error?.message || json.message || "Error al iniciar conexión");
        setLoading(false);
        return;
      }

      // Redirect to Meta OAuth
      window.location.href = json.data.oauth_url;
    } catch {
      setError("Error de red. Intentá de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleConnect}
        disabled={loading}
        className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Instagram className="h-5 w-5" />
        )}
        {loading ? "Conectando..." : "Conectar con Meta"}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </button>
      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 px-3 py-1.5 rounded-lg">{error}</p>
      )}
    </div>
  );
}
