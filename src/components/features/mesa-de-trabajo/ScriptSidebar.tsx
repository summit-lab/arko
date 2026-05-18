"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft, Search, FileText, PanelLeftClose, ChevronRight, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/components/layout/ThemeProvider";
import { CONTENT_STATUSES } from "@/types/content-plan";
import type { ContentItem, ContentStatus } from "@/types/content-plan";
import { useScriptLayout } from "./ScriptLayoutContext";

export type SidebarSibling = Pick<
  ContentItem,
  "id" | "title" | "status" | "content_type" | "planned_date" | "script" | "updated_at"
>;

interface ScriptSidebarProps {
  siblings: SidebarSibling[];
  workspaceId: string;
  onCollapse: () => void;
}

const COLLAPSE_STORAGE_KEY = "scriptSidebar.collapsedGroups";

// Pathname format: /mesa-de-trabajo/<id>/guion
function extractActiveId(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(/\/mesa-de-trabajo\/([^/]+)\/guion/);
  return m?.[1] ?? null;
}

export function ScriptSidebar({ siblings, workspaceId, onCollapse }: ScriptSidebarProps) {
  const pathname = usePathname();
  const activeId = extractActiveId(pathname) ?? "";
  const { activeSibling } = useScriptLayout();
  const t = useTranslations("mesaDeTrabajo");

  // Merge the active sibling published from page.tsx so we can show items
  // that haven't been saved with content yet (and reflect live title edits).
  const mergedSiblings = useMemo(() => {
    if (!activeSibling) return siblings;
    const exists = siblings.some((s) => s.id === activeSibling.id);
    if (exists) {
      return siblings.map((s) => (s.id === activeSibling.id ? activeSibling : s));
    }
    return [activeSibling, ...siblings];
  }, [siblings, activeSibling]);
  const { theme } = useTheme();
  const isLight = theme === "light";
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState<ContentStatus | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<ContentStatus>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  // Restore collapsed groups from sessionStorage
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (raw) setCollapsedGroups(new Set(JSON.parse(raw) as ContentStatus[]));
    } catch {
      // ignore
    }
  }, []);

  // Persist on change
  useEffect(() => {
    window.sessionStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify([...collapsedGroups]));
  }, [collapsedGroups]);

  // ⌘K / Ctrl+K → focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleGroup = useCallback((s: ContentStatus) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  const createInStatus = useCallback(async (status: ContentStatus) => {
    if (creating) return;
    setCreating(status);
    try {
      const res = await fetch("/api/v1/content-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
        body: JSON.stringify({
          title: "Sin título",
          content_type: "reel",
          status,
          platform: "instagram",
        }),
      });
      if (!res.ok) return;
      const json = await res.json() as { data: { item: ContentItem } };
      window.dispatchEvent(new Event("nav:start"));
      router.push(`/mesa-de-trabajo/${json.data.item.id}/guion`);
    } finally {
      setCreating(null);
    }
  }, [creating, workspaceId, router]);

  const border    = isLight ? "rgba(17,17,17,0.08)" : "rgba(255,255,255,0.07)";
  const textMain  = isLight ? "#111111" : "rgba(255,255,255,0.88)";
  const textSub   = isLight ? "rgba(17,17,17,0.45)" : "rgba(255,255,255,0.38)";
  const labelCol  = isLight ? "rgba(17,17,17,0.40)" : "rgba(255,255,255,0.32)";
  const inputBg   = isLight ? "rgba(17,17,17,0.04)" : "rgba(255,255,255,0.04)";
  const activeBg  = isLight ? "rgba(17,17,17,0.07)" : "rgba(255,255,255,0.09)";
  const hoverBg   = isLight ? "rgba(17,17,17,0.04)" : "rgba(255,255,255,0.04)";
  const chipBg    = isLight ? "rgba(17,17,17,0.06)" : "rgba(255,255,255,0.06)";

  // Filter by query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mergedSiblings;
    return mergedSiblings.filter((s) =>
      s.title.toLowerCase().includes(q) ||
      (s.script ?? "").toLowerCase().includes(q)
    );
  }, [mergedSiblings, query]);

  // Group items by status. Within each group, order is inherited from the
  // server query (updated_at DESC) — most-recently-edited or created comes first.
  // We do NOT pin the active item, so the order reflects real usage history.
  const grouped = useMemo(() => {
    const map = new Map<ContentStatus, SidebarSibling[]>();
    for (const s of filtered) {
      const arr = map.get(s.status) ?? [];
      arr.push(s);
      map.set(s.status, arr);
    }
    return CONTENT_STATUSES.map((meta) => ({ meta, items: map.get(meta.value) ?? [] }));
  }, [filtered]);

  return (
    <aside
      className="shrink-0 flex flex-col overflow-hidden"
      style={{ width: 272, borderRight: `1px solid ${border}` }}
    >
      {/* Top: back link + collapse */}
      <div className="px-4 pt-4 pb-2 shrink-0 flex items-center justify-between">
        <Link
          href="/mesa-de-trabajo"
          className="inline-flex items-center gap-1.5 text-[12px] transition-all rounded-md px-2 py-1 -ml-2"
          style={{ color: textSub }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = textMain; (e.currentTarget as HTMLElement).style.background = hoverBg; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = textSub; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <ArrowLeft size={13} strokeWidth={2} />
          {t("scripts.back")}
        </Link>
        <button
          onClick={onCollapse}
          title={t("scripts.collapseSidebar")}
          className="w-7 h-7 rounded-md flex items-center justify-center transition-all"
          style={{ color: textSub }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = textMain; (e.currentTarget as HTMLElement).style.background = hoverBg; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = textSub; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <PanelLeftClose size={14} strokeWidth={1.75} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pt-2 pb-3 shrink-0">
        <div className="relative">
          <Search
            size={13}
            strokeWidth={2}
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: textSub }}
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("scripts.searchPlaceholder")}
            className="w-full text-[12px] outline-none transition-all"
            style={{
              background: inputBg,
              border: `1px solid ${border}`,
              borderRadius: 8,
              padding: "6px 44px 6px 28px",
              color: textMain,
            }}
          />
          <span
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded"
            style={{
              background: chipBg,
              color: textSub,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              pointerEvents: "none",
            }}
          >
            ⌘K
          </span>
        </div>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-2 pb-6">
        {grouped.every((g) => g.items.length === 0) && (
          <div className="px-4 py-6 text-center">
            <p className="text-[12px]" style={{ color: textSub }}>
              {query ? t("scripts.emptyResults") : t("scripts.emptyAll")}
            </p>
          </div>
        )}

        {grouped.map(({ meta, items }) => {
          const isCollapsed = collapsedGroups.has(meta.value);
          const isEmpty = items.length === 0;
          // Hide totally-empty groups unless the user is actively searching (then no point hiding)
          if (isEmpty && !query) return null;

          return (
            <div key={meta.value} className="mb-1">
              {/* Group header row */}
              <div
                className="group flex items-center gap-1 px-1.5 py-1.5 rounded-md transition-colors"
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hoverBg; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <button
                  onClick={() => toggleGroup(meta.value)}
                  className="w-4 h-4 flex items-center justify-center rounded transition-all"
                  style={{ color: textSub }}
                >
                  <ChevronRight
                    size={11}
                    strokeWidth={2.2}
                    style={{
                      transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                      transition: "transform 0.15s ease",
                    }}
                  />
                </button>
                <button
                  onClick={() => toggleGroup(meta.value)}
                  className="flex items-center gap-1.5 flex-1 text-left"
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.dot }} />
                  <p className="text-[10.5px] uppercase tracking-widest" style={{ color: labelCol }}>
                    {t(`status.${meta.value}` as `status.${ContentStatus}`)}
                  </p>
                  <span className="text-[10px] tabular-nums" style={{ color: textSub }}>
                    {items.length}
                  </span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); void createInStatus(meta.value); }}
                  disabled={creating !== null}
                  title={t("scripts.newInGroup", { label: t(`status.${meta.value}` as `status.${ContentStatus}`) })}
                  className="w-5 h-5 rounded flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 disabled:opacity-40"
                  style={{ color: textSub }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = textMain; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = textSub; }}
                >
                  <Plus size={12} strokeWidth={2} />
                </button>
              </div>

              {/* Items (collapsible) */}
              {!isCollapsed && items.map((it) => {
                const active = it.id === activeId;
                return (
                  <Link
                    key={it.id}
                    href={`/mesa-de-trabajo/${it.id}/guion`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ml-3"
                    style={{
                      background: active ? activeBg : "transparent",
                    }}
                    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = hoverBg; }}
                    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <FileText
                      size={12}
                      strokeWidth={1.5}
                      style={{ color: textSub, flexShrink: 0 }}
                    />
                    <p
                      className="text-[12.5px] truncate"
                      style={{ color: active ? textMain : textSub, fontWeight: active ? 500 : 400 }}
                    >
                      {it.title || t("scripts.untitled")}
                    </p>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
