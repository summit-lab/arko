"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function InstagramBackButton() {
  const router = useRouter();

  useEffect(() => {
    router.prefetch("/instagram");
  }, [router]);

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1 && document.referrer.includes("/instagram")) {
      router.back();
      return;
    }

    router.push("/instagram");
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="inline-flex items-center gap-2 text-sm text-zinc-300 transition-colors hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" />
      Volver a Reels
    </button>
  );
}
