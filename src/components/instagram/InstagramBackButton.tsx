"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";

export function InstagramBackButton({ tab = "reels" }: { tab?: string }) {
  const t = useTranslations("igShell");
  const router = useRouter();

  useEffect(() => {
    router.prefetch("/instagram");
  }, [router]);

  function handleBack() {
    window.dispatchEvent(new Event("nav:start"));
    router.push(`/instagram?tab=${tab}`);
  }

  const labelMap: Record<string, string> = {
    reels: t("back.reels"),
    publicaciones: t("back.publications"),
    historias: t("back.stories"),
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="group inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white cursor-pointer"
    >
      <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
      {labelMap[tab] || t("back.instagram")}
    </button>
  );
}
