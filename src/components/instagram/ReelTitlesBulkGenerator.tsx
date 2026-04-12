"use client";

import { useEffect, useRef } from "react";

/**
 * Componente invisible que, al montar, verifica si hay reels sin auto_title
 * y dispara la generación bulk en background.
 * Solo llama a la API una vez por sesión (ref guard).
 */
export function ReelTitlesBulkGenerator({ hasMissingTitles }: { hasMissingTitles: boolean }) {
  const triggered = useRef(false);

  useEffect(() => {
    if (!hasMissingTitles || triggered.current) return;
    triggered.current = true;

    fetch("/api/v1/reels/generate-titles-bulk", { method: "POST" })
      .catch(() => {/* silencioso — no es crítico */});
  }, [hasMissingTitles]);

  return null;
}
