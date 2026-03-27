"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function BootstrapError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[instagram/bootstrap] Unhandled error:", error);
  }, [error]);

  return (
    <div className="px-8 py-10 flex items-center justify-center min-h-[60vh]">
      <div className="glass-card p-8 max-w-md text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
        <h2 className="text-lg font-semibold text-white">
          Error al preparar la sincronización
        </h2>
        <p className="text-white/50 text-sm">
          No se pudo iniciar el proceso de sincronización. Es posible que la conexión con Meta haya fallado.
        </p>
        <a
          href="/onboarding"
          className="inline-block px-5 py-2 text-sm font-medium rounded-xl text-white transition-all"
          style={{
            background: "rgba(139,92,246,0.15)",
            border: "1px solid rgba(139,92,246,0.3)",
          }}
        >
          Volver a conectar
        </a>
      </div>
    </div>
  );
}
