"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function InstagramBackButton({ tab = "reels" }: { tab?: string }) {
  const router = useRouter();

  useEffect(() => {
    router.prefetch("/instagram");
  }, [router]);

  function handleBack() {
    window.dispatchEvent(new Event("nav:start"));
    router.push(`/instagram?tab=${tab}`);
  }

  const labelMap: Record<string, string> = {
    reels: "Volver a Reels",
    publicaciones: "Volver a Publicaciones",
    historias: "Volver a Historias",
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="group inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white cursor-pointer"
    >
      <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
      {labelMap[tab] || "Volver a Instagram"}
    </button>
  );
}
