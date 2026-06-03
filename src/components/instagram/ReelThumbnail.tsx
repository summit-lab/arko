"use client";

import { useState, type ReactNode } from "react";
import { Play } from "lucide-react";

/**
 * Thumbnail robusto para portadas de reels/posts. Usa <img> A PROPOSITO (no
 * next/image):
 *  - Las URLs vienen de reel-media storage (signed, cambian en cada render → romperian
 *    el cache del optimizer) o del CDN de Meta (hostnames variados, URLs efimeras).
 *  - El optimizer on-demand de next/image hacia que las portadas cargaran "de a 2-3"
 *    (1 invocacion serverless + re-fetch a Meta + re-encode POR imagen) y devolvia 502
 *    cuando la URL firmada de scontent ya habia expirado.
 *  - <img> las sirve directo (CDN de Supabase / IG), y onError cae a un placeholder
 *    en vez de dejar un hueco roto.
 *
 * priority: para la primera fila (above-the-fold) — eager + fetchPriority alta, asi
 * arrancan YA en vez de esperar al lazy del resto de la grilla.
 */
export function ReelThumbnail({
  src,
  className = "absolute inset-0 w-full h-full object-cover",
  priority = false,
  placeholderSize = 24,
  placeholder,
}: {
  src: string | null;
  className?: string;
  priority?: boolean;
  placeholderSize?: number;
  /** Reemplaza el placeholder Play por defecto (ej. el icono de carrusel en posts). */
  placeholder?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      placeholder ?? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Play size={placeholderSize} className="text-white/10" />
        </div>
      )
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
