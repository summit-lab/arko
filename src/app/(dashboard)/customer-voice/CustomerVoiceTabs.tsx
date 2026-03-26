"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fingerprint, Swords } from "lucide-react";

interface CustomerVoiceTabsProps {
  adnContent: React.ReactNode;
  competitorContent: React.ReactNode;
}

export function CustomerVoiceTabs({ adnContent, competitorContent }: CustomerVoiceTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") === "competencia" ? "competencia" : "adn") as "adn" | "competencia";
  const [isPending, startTransition] = useTransition();

  const tabs = [
    { id: "adn" as const, label: "ADN de Marca", icon: Fingerprint },
    { id: "competencia" as const, label: "Competencia", icon: Swords },
  ];

  function handleTabChange(tabId: "adn" | "competencia") {
    if (activeTab === tabId) return;
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (tabId === "adn") {
        params.delete("tab");
      } else {
        params.set("tab", tabId);
      }
      const qs = params.toString();
      router.replace(`/customer-voice${qs ? `?${qs}` : ""}`, { scroll: false });
    });
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-8 animate-slide-up stagger-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer
                ${isActive
                  ? "bg-white/[0.08] text-white/90 border border-white/[0.12]"
                  : "text-white/35 hover:text-white/55 hover:bg-white/[0.03] border border-transparent"
                }
              `}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white/70" : "text-white/25"}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className={isPending ? "opacity-60 transition-opacity duration-150" : "transition-opacity duration-150"}>
        {activeTab === "adn" ? adnContent : competitorContent}
      </div>
    </div>
  );
}
