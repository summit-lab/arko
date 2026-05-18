"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/layout/ThemeProvider";
import { ScriptSidebar, type SidebarSibling } from "./ScriptSidebar";
import { ScriptLayoutContext } from "./ScriptLayoutContext";

interface ScriptLayoutShellProps {
  siblings: SidebarSibling[];
  workspaceId: string;
  children: React.ReactNode;
}

export function ScriptLayoutShell({ siblings, workspaceId, children }: ScriptLayoutShellProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const router = useRouter();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [activeSibling, setActiveSibling] = useState<SidebarSibling | null>(null);

  // After mutations (create, delete) we just ask Next to revalidate this
  // segment — the layout will re-run server-side and pass fresh siblings down.
  const refreshSiblings = useCallback(async () => {
    router.refresh();
  }, [router]);

  // Restore sidebar collapse preference
  useEffect(() => {
    const stored = window.sessionStorage.getItem("scriptSidebarCollapsed");
    if (stored === "1") setSidebarCollapsed(true);
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem("scriptSidebarCollapsed", sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  // Disable parent main scroll
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const prev = main.style.overflow;
    main.style.overflow = "hidden";
    return () => { main.style.overflow = prev; };
  }, []);

  // Keyboard shortcuts that apply across both sidebar and page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setSidebarCollapsed((v) => !v);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setFocusMode((v) => !v);
        return;
      }
      if (e.key === "Escape" && focusMode) {
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  const bg = isLight ? "#fafafa" : "rgba(8,8,10,1)";
  const outerClass = focusMode
    ? "fixed inset-0 z-[100] flex h-screen"
    : "flex h-full";

  return (
    <ScriptLayoutContext.Provider
      value={{
        sidebarCollapsed, setSidebarCollapsed,
        focusMode, setFocusMode,
        activeSibling, setActiveSibling,
        refreshSiblings,
      }}
    >
      <div className={outerClass} style={{ background: bg }}>
        {!sidebarCollapsed && !focusMode && (
          <ScriptSidebar
            siblings={siblings}
            workspaceId={workspaceId}
            onCollapse={() => setSidebarCollapsed(true)}
          />
        )}
        {children}
      </div>
    </ScriptLayoutContext.Provider>
  );
}
