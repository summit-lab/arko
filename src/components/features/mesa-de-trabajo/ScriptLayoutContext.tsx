"use client";

import { createContext, useContext } from "react";
import type { SidebarSibling } from "./ScriptSidebar";

export interface ScriptLayoutState {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  focusMode: boolean;
  setFocusMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  // The currently-active script. Set from page.tsx so the sidebar can
  // surface items that don't have a script yet (and reflect live title edits).
  activeSibling: SidebarSibling | null;
  setActiveSibling: (s: SidebarSibling | null) => void;
  // Manually refresh the siblings list (e.g. after creating or deleting an item).
  refreshSiblings: () => Promise<void>;
}

export const ScriptLayoutContext = createContext<ScriptLayoutState | null>(null);

export function useScriptLayout(): ScriptLayoutState {
  const ctx = useContext(ScriptLayoutContext);
  if (!ctx) throw new Error("useScriptLayout must be used inside ScriptLayoutShell");
  return ctx;
}
