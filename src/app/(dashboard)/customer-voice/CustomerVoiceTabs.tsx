"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Fingerprint, Swords, CalendarDays, Target } from "lucide-react";

type TabId = "adn" | "competencia" | "calendario" | "metas";

interface CustomerVoiceTabsProps {
  initialTab: TabId;
  adnContent: React.ReactNode;
  competitorContent: React.ReactNode;
  calendarContent: React.ReactNode;
  metasContent: React.ReactNode;
}

export function CustomerVoiceTabs({ initialTab, adnContent, competitorContent, calendarContent, metasContent }: CustomerVoiceTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const searchParams = useSearchParams();
  const t = useTranslations("customerVoice.tabs");

  const handleTabChange = useCallback((tabId: TabId) => {
    if (activeTab === tabId) return;
    setActiveTab(tabId);
    // Update URL for shareability without server roundtrip
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "adn") {
      params.delete("tab");
    } else {
      params.set("tab", tabId);
    }
    if (tabId !== "calendario") params.delete("month");
    const qs = params.toString();
    window.history.replaceState(null, "", `/customer-voice${qs ? `?${qs}` : ""}`);
  }, [activeTab, searchParams]);

  const tabs = [
    { id: "adn" as const,         label: t("adn"),          icon: Fingerprint },
    { id: "competencia" as const, label: t("competencia"),  icon: Swords },
    { id: "calendario" as const,  label: t("calendario"),   icon: CalendarDays },
    { id: "metas" as const,       label: t("metas"),        icon: Target },
  ];

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

      {/* Tab content — instant switch, no server roundtrip */}
      <div>
        {activeTab === "adn"         && <div key="adn">{adnContent}</div>}
        {activeTab === "competencia" && <div key="competencia">{competitorContent}</div>}
        {activeTab === "calendario"  && <div key="calendario">{calendarContent}</div>}
        {activeTab === "metas"       && <div key="metas">{metasContent}</div>}
      </div>
    </div>
  );
}
