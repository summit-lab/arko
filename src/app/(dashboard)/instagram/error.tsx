"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function InstagramError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[instagram] Unhandled error:", error);
  }, [error]);

  return (
    <div className="px-8 py-10 flex items-center justify-center min-h-[60vh]">
      <div className="glass-card p-8 max-w-md text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
        <h2 className="text-lg font-semibold text-white">
          Algo salió mal
        </h2>
        <p className="text-white/50 text-sm">
          Ocurrió un error al cargar Instagram Intelligence. Intentá de nuevo o reconectá tu cuenta.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={reset}
            className="px-5 py-2 text-sm font-medium rounded-xl text-white transition-all"
            style={{
              background: "rgba(139,92,246,0.15)",
              border: "1px solid rgba(139,92,246,0.3)",
            }}
          >
            Reintentar
          </button>
          <a
            href="/onboarding"
            className="px-5 py-2 text-sm font-medium rounded-xl text-white/60 transition-all hover:text-white"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Reconectar cuenta
          </a>
        </div>
      </div>
    </div>
  );
}
