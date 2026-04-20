"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search, Copy, Check, Eye, Heart, ExternalLink, Sparkles, BookMarked,
  MessageCircleQuestion, List, Zap, Megaphone, GitCompare, Type,
  BookOpen, AlertTriangle, Languages, Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScrapedReel {
  short_code: string | null;
  permalink: string | null;
  caption: string | null;
  likes_count: number | null;
  comments_count: number | null;
  views_count: number | null;
  duration_seconds: number | null;
  published_at: string | null;
  thumbnail_url: string | null;
}

interface Reference {
  id: string;
  brand_name: string | null;
  brand_url: string | null;
  scraped_data: { ig_username?: string; ig_profile_pic_url?: string | null } | null;
  scraped_reels: ScrapedReel[] | null;
}

type HookPattern = "pregunta" | "lista" | "contraste" | "cta" | "historia" | "shock" | "afirmacion";

interface Hook {
  id: string; // reel short_code
  shortCode: string;
  text: string; // first line / sentence of caption
  fullCaption: string;
  pattern: HookPattern;
  referenceId: string;
  referenceName: string;
  referenceHandle: string | null;
  views: number;
  likes: number;
  comments: number;
  permalink: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  engagementRate: number;
  performanceTier: "top" | "mid" | "low";
  language: string; // ISO, 'es' by default
  translation: string | null; // Spanish translation if original not Spanish
  classifiedByAI: boolean;
}

// ─── Pattern classification ──────────────────────────────────────────────────
// Heuristic-only for MVP (no AI). Good enough to bucket 70%+ correctly.

const PATTERN_META: Record<HookPattern, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  pregunta:   { label: "Pregunta",   color: "#38bdf8", bg: "rgba(56,189,248,0.12)",  border: "rgba(56,189,248,0.28)",  icon: MessageCircleQuestion },
  lista:      { label: "Lista",      color: "#c4b5fd", bg: "rgba(196,181,253,0.12)", border: "rgba(196,181,253,0.3)",  icon: List },
  contraste:  { label: "Contraste",  color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)",   icon: GitCompare },
  cta:        { label: "CTA",        color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)",   icon: Megaphone },
  historia:   { label: "Historia",   color: "#fb7185", bg: "rgba(251,113,133,0.12)", border: "rgba(251,113,133,0.3)",  icon: BookOpen },
  shock:      { label: "Shock",      color: "#f472b6", bg: "rgba(244,114,182,0.12)", border: "rgba(244,114,182,0.3)",  icon: AlertTriangle },
  afirmacion: { label: "Afirmación", color: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)",  icon: Zap },
};

function classifyHook(text: string): HookPattern {
  const t = text.trim().toLowerCase();
  if (!t) return "afirmacion";
  if (/^[¿?]/.test(text) || /\?/.test(text.slice(0, 120))) return "pregunta";
  if (/^[\d]+[.)\s-]|^[•\-*]\s/.test(text) || /\s\d+\s+(cosas|formas|errores|tips|trucos|pasos)/i.test(text)) return "lista";
  if (/\b(pero|sin embargo|en cambio|vs|versus|no\s+es\s+lo\s+mismo|dejá\s+de|antes\s+vs|ahora\s+vs)\b/i.test(t)) return "contraste";
  if (/\b(comentá|coment[aá]|escribí|mand[aá]|envi[aá]|segu[íi]me|seguime|dale\s+like|guardá|compartí|link\s+en\s+bio|comenta|escribe|env[ií]ame)\b/i.test(t)) return "cta";
  return "afirmacion";
}

// Extract the first "hook-worthy" chunk of the caption. Usually the first line
// or first sentence, whichever comes first, trimmed to a readable length.
function extractHook(caption: string): string {
  const firstLine = caption.split(/\n/)[0]?.trim() ?? "";
  if (!firstLine) return "";
  // If the first line is already short (<= 120 chars), use it as-is
  if (firstLine.length <= 120) return firstLine;
  // Otherwise cut at the first sentence boundary
  const sentEnd = firstLine.search(/[.!?¡¿]\s/);
  if (sentEnd > 0 && sentEnd < 150) return firstLine.slice(0, sentEnd + 1);
  return firstLine.slice(0, 150).trimEnd() + "…";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function extractHandle(url: string | null): string | null {
  if (!url) return null;
  const clean = url.trim().replace(/\/$/, "");
  if (clean.startsWith("@")) return clean;
  try {
    const u = new URL(clean.startsWith("http") ? clean : `https://${clean}`);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] ? `@${parts[0]}` : null;
  } catch {
    return null;
  }
}

// ─── Hook card ────────────────────────────────────────────────────────────────

function HookCard({ hook }: { hook: Hook }) {
  const [copied, setCopied] = useState(false);
  const meta = PATTERN_META[hook.pattern];
  const PatternIcon = meta.icon;

  function handleCopy() {
    const textToCopy = hook.translation ?? hook.text;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const tierLabel = hook.performanceTier === "top" ? "🔥" : hook.performanceTier === "mid" ? "·" : "";
  const showTranslation = hook.translation && hook.language !== "es";

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-4">
      {/* Hook text (prominent) — shows translation when available, original as secondary */}
      {showTranslation ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[15px] font-light leading-snug text-white/85 line-clamp-4">
            &ldquo;{hook.translation}&rdquo;
          </p>
          <div className="flex items-start gap-1.5 text-[11px] text-white/30 italic">
            <Languages size={10} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">&ldquo;{hook.text}&rdquo; <span className="uppercase not-italic text-white/20">· {hook.language}</span></span>
          </div>
        </div>
      ) : (
        <p className="text-[15px] font-light leading-snug text-white/85 line-clamp-4">
          &ldquo;{hook.text}&rdquo;
        </p>
      )}

      {/* Meta row: pattern + reference + performance */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
          style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
        >
          <PatternIcon size={10} />
          {meta.label}
        </span>
        <span className="text-[10px] text-white/25">·</span>
        <span className="text-[10px] text-white/50 truncate max-w-[180px]">
          {hook.referenceHandle ?? hook.referenceName}
        </span>
        {tierLabel && <span className="text-[10px]">{tierLabel}</span>}
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-3 text-[10px] text-white/35">
        <span className="flex items-center gap-1">
          <Eye size={10} /> {fmt(hook.views)}
        </span>
        <span className="flex items-center gap-1">
          <Heart size={10} /> {fmt(hook.likes)}
        </span>
        {hook.engagementRate > 0 && (
          <span className="flex items-center gap-1">
            <Sparkles size={10} /> {hook.engagementRate.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all cursor-pointer bg-white/[0.05] border border-white/[0.1] text-white/70 hover:bg-white/[0.08] hover:text-white"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copiado" : "Copiar hook"}
        </button>
        {hook.permalink && (
          <a
            href={hook.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center h-[32px] w-[32px] rounded-lg transition-all cursor-pointer bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white"
            title="Ver reel original"
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-12 w-12 rounded-full flex items-center justify-center mb-4 bg-white/[0.04]">
        <BookMarked className="h-5 w-5 text-white/30" />
      </div>
      <p className="text-[14px] text-white/50 font-light">No hay hooks todavía</p>
      <p className="text-[12px] text-white/30 mt-1.5 max-w-sm font-light">
        Agregá referencias en la pestaña <span className="text-white/50">Referencias</span> y escaneá sus reels para armar la biblioteca.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ClassificationResponse {
  reel_short_code: string;
  pattern: HookPattern;
  language: string;
  translation: string | null;
}

export function HookLibraryTab({ references, workspaceId }: { references: Reference[]; workspaceId: string | null }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [patternFilter, setPatternFilter] = useState<HookPattern | "all">("all");
  const [referenceFilter, setReferenceFilter] = useState<string | "all">("all");
  const [tierFilter, setTierFilter] = useState<"top" | "mid" | "all">("all");
  const [classifications, setClassifications] = useState<Map<string, ClassificationResponse>>(new Map());
  const [classifying, setClassifying] = useState(false);

  // Extract all raw hooks (heuristic-classified as fallback while AI loads)
  const rawHooks = useMemo<Hook[]>(() => {
    const allHooks: Hook[] = [];

    for (const ref of references) {
      const reels = ref.scraped_reels ?? [];
      if (reels.length === 0) continue;

      // Compute performance tiers PER REFERENCE (each creator has different scale)
      const sortedByViews = [...reels]
        .filter((r) => (r.views_count ?? 0) > 0)
        .sort((a, b) => (b.views_count ?? 0) - (a.views_count ?? 0));
      const topThreshold = sortedByViews[Math.floor(sortedByViews.length * 0.25)]?.views_count ?? 0;
      const lowThreshold = sortedByViews[Math.floor(sortedByViews.length * 0.75)]?.views_count ?? 0;

      const refName = ref.brand_name ?? ref.scraped_data?.ig_username ?? "Sin nombre";
      const refHandle = ref.scraped_data?.ig_username
        ? `@${ref.scraped_data.ig_username}`
        : extractHandle(ref.brand_url);

      for (const reel of reels) {
        if (!reel.caption) continue;
        const hookText = extractHook(reel.caption);
        if (!hookText || hookText.length < 8) continue;

        const views = reel.views_count ?? 0;
        const likes = reel.likes_count ?? 0;
        const comments = reel.comments_count ?? 0;
        const engRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

        const tier: Hook["performanceTier"] =
          topThreshold > 0 && views >= topThreshold
            ? "top"
            : lowThreshold > 0 && views <= lowThreshold
              ? "low"
              : "mid";

        const shortCode = reel.short_code ?? `anon-${ref.id}-${Math.random().toString(36).slice(2)}`;
        allHooks.push({
          id: `${ref.id}-${shortCode}`,
          shortCode,
          text: hookText,
          fullCaption: reel.caption,
          pattern: classifyHook(hookText),
          referenceId: ref.id,
          referenceName: refName,
          referenceHandle: refHandle,
          views,
          likes,
          comments,
          permalink: reel.permalink,
          thumbnailUrl: reel.thumbnail_url,
          publishedAt: reel.published_at,
          engagementRate: engRate,
          performanceTier: tier,
          language: "es",
          translation: null,
          classifiedByAI: false,
        });
      }
    }

    // Sort: top performers first, then by views
    return allHooks.sort((a, b) => {
      const tierRank = { top: 0, mid: 1, low: 2 };
      if (tierRank[a.performanceTier] !== tierRank[b.performanceTier]) {
        return tierRank[a.performanceTier] - tierRank[b.performanceTier];
      }
      return b.views - a.views;
    });
  }, [references]);

  // Fetch AI classifications once per workspace load
  useEffect(() => {
    if (!workspaceId || rawHooks.length === 0) return;

    // Group hooks by referenceId (classify request is scoped to one reference)
    const byRef = new Map<string, { reel_short_code: string; text: string }[]>();
    for (const h of rawHooks) {
      if (!h.shortCode.startsWith("anon-")) {
        const list = byRef.get(h.referenceId) ?? [];
        list.push({ reel_short_code: h.shortCode, text: h.text });
        byRef.set(h.referenceId, list);
      }
    }

    if (byRef.size === 0) return;

    let cancelled = false;
    setClassifying(true);

    async function classifyAll() {
      const all = new Map<string, ClassificationResponse>();
      for (const [referenceId, hooks] of byRef) {
        try {
          const res = await fetch("/api/v1/hooks/classify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workspace_id: workspaceId, reference_id: referenceId, hooks }),
          });
          if (!res.ok) {
            console.error("[hooks/classify] HTTP", res.status);
            continue;
          }
          const json = (await res.json()) as { data?: { classifications?: ClassificationResponse[] } };
          const classifications = json.data?.classifications ?? [];
          for (const c of classifications) {
            all.set(c.reel_short_code, c);
          }
        } catch (err) {
          console.error("[hooks/classify] error", err);
        }
      }
      if (!cancelled) {
        setClassifications(all);
        setClassifying(false);
      }
    }
    classifyAll();

    return () => { cancelled = true; };
  }, [rawHooks, workspaceId]);

  // Merge raw hooks with AI classifications (fallback to heuristic if AI unavailable)
  const hooks = useMemo<Hook[]>(() => {
    return rawHooks.map((h) => {
      const cls = classifications.get(h.shortCode);
      if (!cls) return h;
      return {
        ...h,
        pattern: cls.pattern,
        language: cls.language,
        translation: cls.translation,
        classifiedByAI: true,
      };
    });
  }, [rawHooks, classifications]);

  // Apply filters
  const filtered = useMemo(() => {
    let result = hooks;

    if (patternFilter !== "all") {
      result = result.filter((h) => h.pattern === patternFilter);
    }
    if (referenceFilter !== "all") {
      result = result.filter((h) => h.referenceId === referenceFilter);
    }
    if (tierFilter === "top") {
      result = result.filter((h) => h.performanceTier === "top");
    } else if (tierFilter === "mid") {
      result = result.filter((h) => h.performanceTier === "mid" || h.performanceTier === "top");
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((h) => h.text.toLowerCase().includes(q));
    }

    return result;
  }, [hooks, patternFilter, referenceFilter, tierFilter, searchQuery]);

  // Pattern counts (for filter chips)
  const patternCounts = useMemo(() => {
    const counts: Record<HookPattern, number> = {
      pregunta: 0, lista: 0, contraste: 0, cta: 0, historia: 0, shock: 0, afirmacion: 0,
    };
    for (const h of hooks) counts[h.pattern]++;
    return counts;
  }, [hooks]);

  const referenceOptions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const h of hooks) {
      if (!byId.has(h.referenceId)) {
        byId.set(h.referenceId, {
          id: h.referenceId,
          name: h.referenceHandle ?? h.referenceName,
        });
      }
    }
    return Array.from(byId.values());
  }, [hooks]);

  if (hooks.length === 0) return <EmptyState />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[13px] text-white/50 font-light flex items-center gap-2">
            Hooks extraídos de tus referencias
            {classifying && (
              <span className="flex items-center gap-1 text-[10px] text-violet-300/80">
                <Loader2 size={10} className="animate-spin" />
                clasificando con IA…
              </span>
            )}
          </p>
          <p className="text-[11px] text-white/20 mt-0.5">
            {hooks.length} hook{hooks.length !== 1 ? "s" : ""} · {referenceOptions.length} referencia{referenceOptions.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] min-w-[240px]">
          <Search size={13} className="text-white/30" />
          <input
            type="text"
            placeholder="Buscar en hooks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[12px] text-white/80 placeholder:text-white/25"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Pattern filter */}
        <button
          onClick={() => setPatternFilter("all")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
            patternFilter === "all"
              ? "bg-white/[0.1] text-white border border-white/[0.15]"
              : "bg-white/[0.04] text-white/40 border border-transparent hover:text-white/70"
          }`}
        >
          <Type size={11} />
          Todos los patrones · {hooks.length}
        </button>
        {(Object.keys(PATTERN_META) as HookPattern[]).map((p) => {
          const meta = PATTERN_META[p];
          const active = patternFilter === p;
          const count = patternCounts[p];
          const Icon = meta.icon;
          return (
            <button
              key={p}
              onClick={() => setPatternFilter(active ? "all" : p)}
              disabled={count === 0}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                count === 0 ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
              }`}
              style={
                active
                  ? { color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }
                  : { color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)", border: "1px solid transparent" }
              }
            >
              <Icon size={11} />
              {meta.label} · {count}
            </button>
          );
        })}

        <div className="h-4 w-px bg-white/[0.08] mx-1" />

        {/* Performance tier */}
        {([
          { key: "all", label: "Todos" },
          { key: "mid", label: "Mid+Top" },
          { key: "top", label: "🔥 Top" },
        ] as { key: "all" | "mid" | "top"; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTierFilter(t.key)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
              tierFilter === t.key
                ? "bg-white/[0.1] text-white border border-white/[0.15]"
                : "bg-white/[0.04] text-white/40 border border-transparent hover:text-white/70"
            }`}
          >
            {t.label}
          </button>
        ))}

        {/* Reference filter */}
        {referenceOptions.length > 1 && (
          <>
            <div className="h-4 w-px bg-white/[0.08] mx-1" />
            <select
              value={referenceFilter}
              onChange={(e) => setReferenceFilter(e.target.value)}
              className="px-3 py-1 rounded-full text-[11px] font-medium bg-white/[0.04] border border-white/[0.08] text-white/60 cursor-pointer outline-none"
            >
              <option value="all">Todas las referencias</option>
              {referenceOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[13px] text-white/30 font-light">
            No hay hooks que coincidan con los filtros
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((hook) => (
            <HookCard key={hook.id} hook={hook} />
          ))}
        </div>
      )}
    </div>
  );
}
