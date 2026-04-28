"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Plus, ExternalLink, X, Loader2, Sparkles, RefreshCw, Users,
  CheckCircle2, Search, Copy, Check, Eye, Heart, BookMarked,
  MessageCircleQuestion, List, Zap, Megaphone, GitCompare,
  BookOpen, AlertTriangle, Languages, Type, ArrowUpDown, Play,
  Brain, Target, Lightbulb, Wand2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScrapedProfile {
  ig_username?: string;
  ig_full_name?: string | null;
  ig_bio?: string | null;
  ig_follower_count?: number | null;
  ig_post_count?: number | null;
  ig_profile_pic_url?: string | null;
  ig_is_verified?: boolean;
  ig_business_category?: string | null;
}

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

interface ReelAnalysis {
  reference_id: string;
  reel_short_code: string;
  hook_text: string | null;
  hook_type: string | null;
  narrative_structure: string | null;
  content_type: string | null;
  cta_text: string | null;
  cta_type: string | null;
  topic_cluster: string | null;
  style_notes: string | null;
  strengths: string | null;
  weaknesses: string | null;
  ai_summary: string | null;
  model_used: string | null;
  analyzed_at: string;
}

interface Reference {
  id: string;
  brand_name: string | null;
  brand_url: string | null;
  what_they_like: string | null;
  created_at: string;
  scraped_data: ScrapedProfile | null;
  scraped_reels: ScrapedReel[] | null;
  last_scraped_at: string | null;
  reference_reel_analysis?: ReelAnalysis[];
}

type HookPattern = "pregunta" | "lista" | "contraste" | "cta" | "historia" | "shock" | "afirmacion";

interface Hook {
  id: string;
  shortCode: string;
  text: string;
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
  engagementRate: number;
  performanceTier: "top" | "mid" | "low";
  language: string;
  translation: string | null;
  classifiedByAI: boolean;
  analysis: ReelAnalysis | null;
}

interface ClassificationResponse {
  reel_short_code: string;
  pattern: HookPattern;
  language: string;
  translation: string | null;
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
  } catch { return null; }
}

function toIgUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const handle = url.startsWith("@") ? url.slice(1) : url;
  return `https://instagram.com/${handle}`;
}

// Heuristic classifier (fallback while Gemini loads or fails)
function classifyHookHeuristic(text: string): HookPattern {
  const t = text.trim().toLowerCase();
  if (!t) return "afirmacion";
  if (/^[¿?]/.test(text) || /\?/.test(text.slice(0, 120))) return "pregunta";
  if (/^[\d]+[.)\s-]|^[•\-*]\s/.test(text) || /\s\d+\s+(cosas|formas|errores|tips|trucos|pasos)/i.test(text)) return "lista";
  if (/\b(pero|sin embargo|en cambio|vs|versus|no\s+es\s+lo\s+mismo|dejá\s+de|antes\s+vs|ahora\s+vs)\b/i.test(t)) return "contraste";
  if (/\b(comentá|coment[aá]|escribí|mand[aá]|envi[aá]|segu[íi]me|seguime|dale\s+like|guardá|compartí|link\s+en\s+bio|comenta|escribe|env[ií]ame|comment)\b/i.test(t)) return "cta";
  return "afirmacion";
}

function extractHook(caption: string): string {
  const firstLine = caption.split(/\n/)[0]?.trim() ?? "";
  if (!firstLine) return "";
  if (firstLine.length <= 120) return firstLine;
  const sentEnd = firstLine.search(/[.!?¡¿]\s/);
  if (sentEnd > 0 && sentEnd < 150) return firstLine.slice(0, sentEnd + 1);
  return firstLine.slice(0, 150).trimEnd() + "…";
}

// ─── Pattern meta ─────────────────────────────────────────────────────────────

// Pattern meta — labels translated at consumer site via t("references.patterns.<key>")
const PATTERN_META: Record<HookPattern, { color: string; bg: string; border: string; icon: React.ElementType }> = {
  pregunta:   { color: "#38bdf8", bg: "rgba(56,189,248,0.12)",  border: "rgba(56,189,248,0.28)",  icon: MessageCircleQuestion },
  lista:      { color: "#c4b5fd", bg: "rgba(196,181,253,0.12)", border: "rgba(196,181,253,0.3)",  icon: List },
  contraste:  { color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)",   icon: GitCompare },
  cta:        { color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)",   icon: Megaphone },
  historia:   { color: "#fb7185", bg: "rgba(251,113,133,0.12)", border: "rgba(251,113,133,0.3)",  icon: BookOpen },
  shock:      { color: "#f472b6", bg: "rgba(244,114,182,0.12)", border: "rgba(244,114,182,0.3)",  icon: AlertTriangle },
  afirmacion: { color: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)",  icon: Zap },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

const PALETTES = [
  { bg: "rgba(139,92,246,0.18)",  border: "rgba(139,92,246,0.35)",  text: "#a78bfa" },
  { bg: "rgba(56,189,248,0.15)",  border: "rgba(56,189,248,0.3)",   text: "#38bdf8" },
  { bg: "rgba(45,212,191,0.15)",  border: "rgba(45,212,191,0.3)",   text: "#2dd4bf" },
  { bg: "rgba(251,191,36,0.13)",  border: "rgba(251,191,36,0.28)",  text: "#fbbf24" },
  { bg: "rgba(251,113,133,0.15)", border: "rgba(251,113,133,0.3)",  text: "#fb7185" },
];

function palette(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return PALETTES[Math.abs(h) % PALETTES.length]!;
}

function Avatar({ url, name, size = 24 }: { url?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const p = palette(name);
  if (!url || failed) {
    return (
      <div className="shrink-0 flex items-center justify-center rounded-full font-light"
        style={{ width: size, height: size, background: p.bg, border: `1px solid ${p.border}`, color: p.text, fontSize: size * 0.42 }}>
        {name.trim().charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)} />
  );
}

// ─── Reference chip ──────────────────────────────────────────────────────────

function ReferenceChip({
  reference, active, reelsCount, analyzedCount, onClick, onScrape, onAnalyzeAll, onDelete, workspaceId,
}: {
  reference: Reference;
  active: boolean;
  reelsCount: number;
  analyzedCount: number;
  onClick: () => void;
  onScrape: () => Promise<void>;
  onAnalyzeAll: () => Promise<void>;
  onDelete: () => Promise<void>;
  workspaceId: string;
}) {
  void workspaceId;
  const t = useTranslations("igAdvanced");
  const [scraping, setScraping] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const name = reference.scraped_data?.ig_username
    ? `@${reference.scraped_data.ig_username}`
    : extractHandle(reference.brand_url) ?? reference.brand_name ?? t("references.unnamed");

  async function handleScrape(e: React.MouseEvent) {
    e.stopPropagation();
    setScraping(true);
    try { await onScrape(); } finally { setScraping(false); }
  }

  async function handleAnalyzeAll(e: React.MouseEvent) {
    e.stopPropagation();
    setAnalyzing(true);
    try { await onAnalyzeAll(); } finally { setAnalyzing(false); }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  }

  const hasReels = reelsCount > 0;

  return (
    <div
      onClick={onClick}
      onMouseLeave={() => setConfirmDel(false)}
      className={`group inline-flex items-center gap-2 pl-1 pr-2 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer border ${
        active
          ? "bg-violet-500/20 border-violet-500/40 text-violet-900 dark:text-violet-100"
          : hasReels
          ? "bg-white/[0.05] border-white/[0.08] text-foreground/60 hover:bg-white/[0.08]"
          : "bg-white/[0.02] border-white/[0.06] text-foreground/35 hover:text-foreground/60"
      }`}
    >
      <Avatar url={reference.scraped_data?.ig_profile_pic_url} name={name} size={20} />
      <span className="truncate max-w-[140px]">{name}</span>
      <span className={`text-[10px] ${active ? "text-violet-800/70 dark:text-violet-200/70" : "text-muted-foreground/70"}`}>
        · {reelsCount}
      </span>
      {!hasReels && reference.brand_url && (
        <button
          onClick={handleScrape}
          disabled={scraping}
          title={t("references.chip.scanTitle")}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-violet-500/20 border border-violet-500/40 text-violet-800 dark:text-violet-200 hover:bg-violet-500/30 transition-all disabled:opacity-40"
        >
          {scraping ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />}
          {scraping ? t("references.chip.scanning") : t("references.chip.scan")}
        </button>
      )}
      {hasReels && analyzedCount < reelsCount && (
        <button
          onClick={handleAnalyzeAll}
          disabled={analyzing}
          title={t("references.chip.analyzeTitle", { count: Math.min(5, reelsCount - analyzedCount) })}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-violet-500/20 border border-violet-500/40 text-violet-800 dark:text-violet-200 hover:bg-violet-500/30 transition-all disabled:opacity-40"
        >
          {analyzing ? <Loader2 size={9} className="animate-spin" /> : <Wand2 size={9} />}
          {analyzing ? t("references.chip.analyzing") : t("references.chip.analyze")}
        </button>
      )}
      <button
        onClick={handleDelete}
        disabled={deleting}
        title={confirmDel ? t("references.chip.confirmDelete") : t("references.chip.deleteRef")}
        className={`h-5 w-5 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 ${
          confirmDel ? "bg-rose-500/25 text-rose-300 opacity-100" : "hover:bg-white/[0.08] text-white/25 hover:text-white/60"
        }`}
      >
        {deleting ? <Loader2 size={8} className="animate-spin" /> : <X size={9} />}
      </button>
    </div>
  );
}

// ─── Hook card ────────────────────────────────────────────────────────────────

function HookThumb({ src }: { src: string | null }) {
  const [errored, setErrored] = useState(false);
  const show = src && !errored;
  return (
    <div className="relative w-[84px] h-[116px] rounded-xl overflow-hidden shrink-0 bg-white/[0.05] border border-white/[0.08]">
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <Play className="h-4 w-4 text-white/20" />
        </div>
      )}
    </div>
  );
}

function AnalysisModal({
  hook, analysis, analyzing, onClose, onAnalyze,
}: {
  hook: Hook;
  analysis: ReelAnalysis | null;
  analyzing: boolean;
  onClose: () => void;
  onAnalyze: () => void;
}) {
  const t = useTranslations("igAdvanced");
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-foreground/50 dark:bg-black/75 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-6 space-y-5 bg-popover text-popover-foreground border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Brain size={14} className="text-violet-600 dark:text-violet-300" />
            <p className="text-[13px] font-light">
              {t("references.modal.title")}
              <span className="text-muted-foreground ml-2">
                · {hook.referenceHandle ?? hook.referenceName}
              </span>
            </p>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
            <X size={13} />
          </button>
        </div>

        <div className="flex gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          <HookThumb src={hook.thumbnailUrl} />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-light leading-snug text-foreground/90 line-clamp-3">
              &ldquo;{hook.translation ?? hook.text}&rdquo;
            </p>
            <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground mt-2">
              <span className="flex items-center gap-0.5"><Eye size={10} /> {fmt(hook.views)}</span>
              <span className="flex items-center gap-0.5"><Heart size={10} /> {fmt(hook.likes)}</span>
              {hook.engagementRate > 0 && (
                <span className="flex items-center gap-0.5"><Sparkles size={10} /> {hook.engagementRate.toFixed(1)}%</span>
              )}
            </div>
          </div>
        </div>

        {!analysis ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            {analyzing ? (
              <>
                <Loader2 size={16} className="animate-spin text-violet-600 dark:text-violet-300" />
                <p className="text-[12px] text-muted-foreground">{t("references.modal.analyzingWithGemini")}</p>
              </>
            ) : (
              <>
                <p className="text-[12px] text-muted-foreground max-w-md">
                  {t("references.modal.notAnalyzedYet")}
                </p>
                <button
                  onClick={onAnalyze}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-medium transition-all cursor-pointer text-violet-800 dark:text-violet-200"
                  style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)" }}
                >
                  <Wand2 size={12} /> {t("references.modal.analyzeNow")}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4 text-[12px]">
            {analysis.ai_summary && (
              <Section icon={Brain} title={t("references.modal.summary")}>{analysis.ai_summary}</Section>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {analysis.hook_type && (
                <MetaItem icon={Target} label={t("references.modal.hookType")} value={analysis.hook_type} />
              )}
              {analysis.content_type && (
                <MetaItem icon={Lightbulb} label={t("references.modal.contentType")} value={analysis.content_type} />
              )}
              {analysis.topic_cluster && (
                <MetaItem icon={BookOpen} label={t("references.modal.topic")} value={analysis.topic_cluster} />
              )}
              {analysis.cta_type && analysis.cta_type !== "ninguno" && (
                <MetaItem icon={Megaphone} label={t("references.modal.cta")} value={analysis.cta_type} />
              )}
            </div>
            {analysis.narrative_structure && (
              <Section icon={BookOpen} title={t("references.modal.narrativeStructure")}>{analysis.narrative_structure}</Section>
            )}
            {analysis.cta_text && (
              <Section icon={Megaphone} title={t("references.modal.ctaText")}>{analysis.cta_text}</Section>
            )}
            {analysis.strengths && (
              <Section icon={CheckCircle2} title={t("references.modal.strengths")} tone="positive">{analysis.strengths}</Section>
            )}
            {analysis.weaknesses && (
              <Section icon={AlertTriangle} title={t("references.modal.weaknesses")} tone="negative">{analysis.weaknesses}</Section>
            )}
            <div className="flex items-center justify-between pt-2">
              <p className="text-[10px] text-muted-foreground">{t("references.modal.model")}: {analysis.model_used ?? "—"}</p>
              <button
                onClick={onAnalyze}
                disabled={analyzing}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-medium transition-all cursor-pointer bg-white/[0.05] border border-white/[0.1] text-foreground/70 hover:bg-white/[0.1] disabled:opacity-40"
              >
                {analyzing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                {analyzing ? t("references.modal.reanalyzing") : t("references.modal.reanalyze")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, tone = "neutral", children }: {
  icon: React.ElementType; title: string; tone?: "neutral" | "positive" | "negative"; children: React.ReactNode;
}) {
  const toneColor = tone === "positive"
    ? "text-emerald-600 dark:text-emerald-400"
    : tone === "negative"
    ? "text-amber-600 dark:text-amber-400"
    : "text-violet-600 dark:text-violet-300";
  return (
    <div className="space-y-1.5">
      <p className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium ${toneColor}`}>
        <Icon size={10} /> {title}
      </p>
      <div className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{children}</div>
    </div>
  );
}

function MetaItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
      <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
        <Icon size={9} /> {label}
      </p>
      <p className="text-[12px] font-medium capitalize">{value}</p>
    </div>
  );
}

function HookCard({
  hook, workspaceId, onAnalysisUpdate,
}: {
  hook: Hook;
  workspaceId: string | null;
  onAnalysisUpdate: (referenceId: string, analysis: ReelAnalysis) => void;
}) {
  const t = useTranslations("igAdvanced");
  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const meta = PATTERN_META[hook.pattern];
  const PatternIcon = meta.icon;

  function handleCopy() {
    const textToCopy = hook.translation ?? hook.text;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  async function handleAnalyze() {
    if (!workspaceId || hook.shortCode.startsWith("anon-")) return;
    setAnalyzing(true);
    try {
      const res = await fetch(
        `/api/v1/references/${hook.referenceId}/reels/${encodeURIComponent(hook.shortCode)}/analyze?workspace_id=${workspaceId}`,
        { method: "POST" }
      );
      const json = await res.json() as { data?: { analysis: ReelAnalysis } };
      if (res.ok && json.data?.analysis) {
        onAnalysisUpdate(hook.referenceId, json.data.analysis);
      }
    } finally {
      setAnalyzing(false);
    }
  }

  const tierLabel = hook.performanceTier === "top" ? "🔥" : hook.performanceTier === "mid" ? "·" : "";
  const showTranslation = !!hook.translation && hook.language !== "es";
  const canAnalyze = !hook.shortCode.startsWith("anon-") && !!workspaceId;
  const hasAnalysis = !!hook.analysis;

  return (
    <div className="glass-card rounded-2xl p-4 flex gap-3">
      <HookThumb src={hook.thumbnailUrl} />

      <div className="flex-1 min-w-0 flex flex-col gap-2.5">
        {showTranslation ? (
          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-light leading-snug text-foreground/85 line-clamp-3">
              &ldquo;{hook.translation}&rdquo;
            </p>
            <div className="flex items-start gap-1 text-[10px] text-muted-foreground/80 italic">
              <Languages size={9} className="mt-0.5 shrink-0" />
              <span className="line-clamp-1">&ldquo;{hook.text}&rdquo; <span className="uppercase not-italic">· {hook.language}</span></span>
            </div>
          </div>
        ) : (
          <p className="text-[13px] font-light leading-snug text-foreground/85 line-clamp-4">
            &ldquo;{hook.text}&rdquo;
          </p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium"
            style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
          >
            <PatternIcon size={9} />
            {t(`references.patterns.${hook.pattern}`)}
          </span>
          <span className="text-[10px] text-muted-foreground/70 truncate max-w-[140px]">
            {hook.referenceHandle ?? hook.referenceName}
          </span>
          {tierLabel && <span className="text-[10px]">{tierLabel}</span>}
        </div>

        <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5"><Eye size={10} /> {fmt(hook.views)}</span>
          <span className="flex items-center gap-0.5"><Heart size={10} /> {fmt(hook.likes)}</span>
          {hook.engagementRate > 0 && (
            <span className="flex items-center gap-0.5"><Sparkles size={10} /> {hook.engagementRate.toFixed(1)}%</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-auto pt-1">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer bg-white/[0.05] border border-white/[0.1] text-foreground/70 hover:bg-white/[0.08] hover:text-foreground"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? t("references.card.copied") : t("references.card.copy")}
          </button>
          {canAnalyze && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer text-violet-800 dark:text-violet-200"
              style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}
              title={hasAnalysis ? t("references.card.viewAnalysisTitle") : t("references.card.analyzeTitle")}
            >
              <Brain size={11} /> {hasAnalysis ? t("references.card.viewAnalysis") : t("references.card.analyze")}
            </button>
          )}
          {hook.permalink && (
            <a
              href={hook.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center h-[28px] w-[28px] rounded-lg transition-all cursor-pointer bg-white/[0.04] border border-white/[0.08] text-muted-foreground hover:text-foreground"
              title={t("references.card.viewOriginal")}
            >
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>

      {modalOpen && (
        <AnalysisModal
          hook={hook}
          analysis={hook.analysis}
          analyzing={analyzing}
          onClose={() => setModalOpen(false)}
          onAnalyze={handleAnalyze}
        />
      )}
    </div>
  );
}

// ─── Add Modal ────────────────────────────────────────────────────────────────

function AddModal({ onClose, onSave, workspaceId }: {
  onClose: () => void;
  onSave: (ref: Reference) => void;
  workspaceId: string;
}) {
  const t = useTranslations("igAdvanced");
  const [brandName, setBrandName]       = useState("");
  const [brandUrl, setBrandUrl]         = useState("");
  const [whatTheyLike, setWhatTheyLike] = useState("");
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brandName.trim()) { setError(t("references.add.errors.nameRequired")); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/v1/references?workspace_id=${workspaceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_name: brandName, brand_url: brandUrl || null, what_they_like: whatTheyLike || null }),
      });
      const json = await res.json() as { data?: { reference: Reference }; message?: string };
      if (!res.ok) { setError(json.message ?? t("references.add.errors.saving")); return; }
      onSave(json.data!.reference);
      onClose();
    } catch { setError(t("references.add.errors.connection")); }
    finally { setSaving(false); }
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--muted)", border: "1px solid var(--border)",
    borderRadius: 12, padding: "10px 14px", color: "var(--foreground)",
    fontSize: 13, outline: "none", width: "100%", fontFamily: "inherit",
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-foreground/50 dark:bg-black/75 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5 bg-popover text-popover-foreground border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-violet-400" />
            <p className="text-[14px] text-white/80 font-light">{t("references.add.title")}</p>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-all">
            <X size={13} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">{t("references.add.fields.name")}</label>
            <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder={t("references.add.placeholders.name")} style={inputStyle} autoFocus />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">{t("references.add.fields.url")}</label>
            <input type="text" value={brandUrl} onChange={(e) => setBrandUrl(e.target.value)} placeholder={t("references.add.placeholders.url")} style={inputStyle} />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">{t("references.add.fields.inspiration")} <span className="text-white/20 normal-case">{t("references.add.fields.optional")}</span></label>
            <textarea value={whatTheyLike} onChange={(e) => setWhatTheyLike(e.target.value)} placeholder={t("references.add.placeholders.inspiration")} rows={3} style={{ ...inputStyle, resize: "vertical" as const, minHeight: 80 }} />
          </div>

          {error && (
            <p className="text-[11px] text-rose-400 flex items-center gap-1.5">
              <AlertTriangle size={11} /> {error}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-10 rounded-xl text-[12px] font-medium transition-all cursor-pointer bg-white/[0.04] border border-white/[0.08] text-white/50">
              {t("references.add.cancel")}
            </button>
            <button type="submit" disabled={saving || !brandName.trim()}
              className="flex-1 h-10 rounded-xl text-[12px] font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 text-violet-800 dark:text-violet-200"
              style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)" }}>
              {saving ? <><Loader2 size={11} className="animate-spin" /> {t("references.add.saving")}</> : <><Plus size={11} /> {t("references.add.add")}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ReferencesTab({ workspaceId, initialReferences }: { workspaceId: string | null; initialReferences?: Reference[] }) {
  const t = useTranslations("igAdvanced");
  const [references, setReferences] = useState<Reference[]>(initialReferences ?? []);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [patternFilter, setPatternFilter] = useState<HookPattern | "all">("all");
  const [referenceFilter, setReferenceFilter] = useState<string | "all">("all");
  const [tierFilter, setTierFilter] = useState<"top" | "mid" | "all">("all");
  const [sortBy, setSortBy] = useState<"views" | "likes" | "engagement" | "recent">("views");
  const [classifications, setClassifications] = useState<Map<string, ClassificationResponse>>(new Map());
  const [classifying, setClassifying] = useState(false);

  function handleSave(ref: Reference) {
    setReferences((prev) => [...prev, ref]);
  }

  async function handleDeleteRef(id: string) {
    await fetch(`/api/v1/references/${id}?workspace_id=${workspaceId}`, { method: "DELETE" });
    setReferences((prev) => prev.filter((r) => r.id !== id));
    if (referenceFilter === id) setReferenceFilter("all");
  }

  async function handleScrapeRef(id: string) {
    const res = await fetch(`/api/v1/references/${id}/scrape?workspace_id=${workspaceId}`, { method: "POST" });
    const json = await res.json() as { data?: { scraped_data: ScrapedProfile; scraped_reels: ScrapedReel[] } };
    if (res.ok && json.data) {
      setReferences((prev) => prev.map((r) => r.id === id ? {
        ...r,
        scraped_data: json.data!.scraped_data,
        scraped_reels: json.data!.scraped_reels,
        last_scraped_at: new Date().toISOString(),
      } : r));
    }
  }

  async function handleAnalyzeAllRef(id: string) {
    const res = await fetch(`/api/v1/references/${id}/analyze-all?workspace_id=${workspaceId}`, { method: "POST" });
    const json = await res.json() as { data?: { analyses: ReelAnalysis[] } };
    if (res.ok && json.data) {
      setReferences((prev) => prev.map((r) => r.id === id
        ? { ...r, reference_reel_analysis: json.data!.analyses }
        : r));
    }
  }

  function handleAnalysisUpdate(referenceId: string, analysis: ReelAnalysis) {
    setReferences((prev) => prev.map((r) => {
      if (r.id !== referenceId) return r;
      const existing = r.reference_reel_analysis ?? [];
      const filtered = existing.filter((a) => a.reel_short_code !== analysis.reel_short_code);
      return { ...r, reference_reel_analysis: [...filtered, analysis] };
    }));
  }

  // Extract all raw hooks (heuristic classified, AI overrides on load)
  const rawHooks = useMemo<Hook[]>(() => {
    const allHooks: Hook[] = [];
    for (const ref of references) {
      const reels = ref.scraped_reels ?? [];
      if (reels.length === 0) continue;

      const sortedByViews = [...reels]
        .filter((r) => (r.views_count ?? 0) > 0)
        .sort((a, b) => (b.views_count ?? 0) - (a.views_count ?? 0));
      const topThreshold = sortedByViews[Math.floor(sortedByViews.length * 0.25)]?.views_count ?? 0;
      const lowThreshold = sortedByViews[Math.floor(sortedByViews.length * 0.75)]?.views_count ?? 0;

      const refName = ref.brand_name ?? ref.scraped_data?.ig_username ?? t("references.unnamed");
      const refHandle = ref.scraped_data?.ig_username
        ? `@${ref.scraped_data.ig_username}`
        : extractHandle(ref.brand_url);

      const analysesByCode = new Map<string, ReelAnalysis>();
      for (const a of ref.reference_reel_analysis ?? []) {
        analysesByCode.set(a.reel_short_code, a);
      }

      for (const reel of reels) {
        if (!reel.caption) continue;
        const hookText = extractHook(reel.caption);
        if (!hookText || hookText.length < 8) continue;

        const views = reel.views_count ?? 0;
        const likes = reel.likes_count ?? 0;
        const comments = reel.comments_count ?? 0;
        const engRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

        const tier: Hook["performanceTier"] =
          topThreshold > 0 && views >= topThreshold ? "top"
          : lowThreshold > 0 && views <= lowThreshold ? "low"
          : "mid";

        const shortCode = reel.short_code ?? `anon-${ref.id}-${Math.random().toString(36).slice(2)}`;
        allHooks.push({
          id: `${ref.id}-${shortCode}`,
          shortCode,
          text: hookText,
          fullCaption: reel.caption,
          pattern: classifyHookHeuristic(hookText),
          referenceId: ref.id,
          referenceName: refName,
          referenceHandle: refHandle,
          views, likes, comments,
          permalink: reel.permalink,
          thumbnailUrl: reel.thumbnail_url,
          engagementRate: engRate,
          performanceTier: tier,
          language: "es",
          translation: null,
          classifiedByAI: false,
          analysis: reel.short_code ? analysesByCode.get(reel.short_code) ?? null : null,
        });
      }
    }

    return allHooks.sort((a, b) => {
      const tierRank = { top: 0, mid: 1, low: 2 };
      if (tierRank[a.performanceTier] !== tierRank[b.performanceTier]) {
        return tierRank[a.performanceTier] - tierRank[b.performanceTier];
      }
      return b.views - a.views;
    });
  }, [references, t]);

  // Fetch AI classifications
  useEffect(() => {
    if (!workspaceId || rawHooks.length === 0) return;
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
          if (!res.ok) continue;
          const json = (await res.json()) as { data?: { classifications?: ClassificationResponse[] } };
          const classifications = json.data?.classifications ?? [];
          for (const c of classifications) all.set(c.reel_short_code, c);
        } catch (err) {
          console.error("[hooks/classify]", err);
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

  // Merge AI classifications
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

  // Reel count per reference
  const reelsByRef = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of references) {
      m.set(r.id, (r.scraped_reels ?? []).length);
    }
    return m;
  }, [references]);

  // Analyzed reel count per reference (for chip "Analizar" visibility)
  const analyzedByRef = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of references) {
      m.set(r.id, (r.reference_reel_analysis ?? []).length);
    }
    return m;
  }, [references]);

  // Filter + sort hooks
  const filtered = useMemo(() => {
    let result = hooks;
    if (patternFilter !== "all") result = result.filter((h) => h.pattern === patternFilter);
    if (referenceFilter !== "all") result = result.filter((h) => h.referenceId === referenceFilter);
    if (tierFilter === "top") result = result.filter((h) => h.performanceTier === "top");
    else if (tierFilter === "mid") result = result.filter((h) => h.performanceTier === "mid" || h.performanceTier === "top");
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((h) =>
        h.text.toLowerCase().includes(q) ||
        (h.translation ?? "").toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      if (sortBy === "views") return b.views - a.views;
      if (sortBy === "likes") return b.likes - a.likes;
      if (sortBy === "engagement") return b.engagementRate - a.engagementRate;
      return 0;
    });
  }, [hooks, patternFilter, referenceFilter, tierFilter, searchQuery, sortBy]);

  const patternCounts = useMemo(() => {
    const counts: Record<HookPattern, number> = {
      pregunta: 0, lista: 0, contraste: 0, cta: 0, historia: 0, shock: 0, afirmacion: 0,
    };
    for (const h of hooks) counts[h.pattern]++;
    return counts;
  }, [hooks]);

  const totalHooks = hooks.length;

  return (
    <>
      {showModal && workspaceId && (
        <AddModal onClose={() => setShowModal(false)} onSave={handleSave} workspaceId={workspaceId} />
      )}

      <div className="space-y-5">
        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[13px] text-white/60 font-light flex items-center gap-2">
              {t("references.headerTitle")}
              {classifying && (
                <span className="flex items-center gap-1 text-[10px] text-violet-700 dark:text-violet-300/70">
                  <Loader2 size={10} className="animate-spin" />
                  {t("references.classifying")}
                </span>
              )}
            </p>
            <p className="text-[11px] text-white/25 mt-0.5">
              {t("references.refCount", { count: references.length })}
              {totalHooks > 0 && ` · ${t("references.hookCount", { count: totalHooks })}`}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-medium transition-all cursor-pointer text-violet-800 dark:text-violet-200"
            style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}
          >
            <Plus size={13} /> {t("references.addBtn")}
          </button>
        </div>

        {/* ── Empty state (no references at all) ── */}
        {references.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-12 w-12 rounded-full flex items-center justify-center mb-4 bg-white/[0.04]">
              <BookMarked className="h-5 w-5 text-white/30" />
            </div>
            <p className="text-[14px] text-white/60 font-light">{t("references.empty.title")}</p>
            <p className="text-[12px] text-white/30 mt-1.5 max-w-sm font-light">
              {t("references.empty.body")}
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-5 flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium transition-all cursor-pointer text-violet-800 dark:text-violet-200"
              style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}
            >
              <Plus size={13} /> {t("references.empty.cta")}
            </button>
          </div>
        )}

        {/* ── Reference chips (when there are references) ── */}
        {references.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setReferenceFilter("all")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer border ${
                referenceFilter === "all"
                  ? "bg-white/[0.1] border-white/[0.15] text-white"
                  : "bg-white/[0.04] border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              {t("references.filters.all")} · {totalHooks}
            </button>
            {references.map((ref) => (
              <ReferenceChip
                key={ref.id}
                reference={ref}
                active={referenceFilter === ref.id}
                reelsCount={reelsByRef.get(ref.id) ?? 0}
                analyzedCount={analyzedByRef.get(ref.id) ?? 0}
                onClick={() => setReferenceFilter(referenceFilter === ref.id ? "all" : ref.id)}
                onScrape={() => handleScrapeRef(ref.id)}
                onAnalyzeAll={() => handleAnalyzeAllRef(ref.id)}
                onDelete={() => handleDeleteRef(ref.id)}
                workspaceId={workspaceId ?? ""}
              />
            ))}
          </div>
        )}

        {/* ── Hook filters + hook grid (only if any hooks exist) ── */}
        {references.length > 0 && totalHooks === 0 && (
          <div className="py-16 text-center rounded-xl border border-dashed border-white/[0.08]">
            <p className="text-[13px] text-white/40 font-light">
              {t("references.noScrapedReels.title")}
            </p>
            <p className="text-[11px] text-white/25 mt-1.5 font-light">
              {t.rich("references.noScrapedReels.hint", {
                scan: (chunks) => <span className="text-violet-700 dark:text-violet-300 font-medium">{chunks}</span>,
              })}
            </p>
          </div>
        )}

        {totalHooks > 0 && (
          <>
            {/* Filter row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] min-w-[200px]">
                <Search size={12} className="text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t("references.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-[11px] text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="h-4 w-px bg-white/[0.08] mx-1" />

              {/* Pattern chips */}
              <button
                onClick={() => setPatternFilter("all")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                  patternFilter === "all"
                    ? "bg-white/[0.1] text-white border border-white/[0.15]"
                    : "bg-white/[0.04] text-white/40 border border-transparent hover:text-white/70"
                }`}
              >
                <Type size={11} />
                {t("references.filters.allPatterns")}
              </button>
              {(Object.keys(PATTERN_META) as HookPattern[]).map((p) => {
                const meta = PATTERN_META[p];
                const count = patternCounts[p];
                const active = patternFilter === p;
                const Icon = meta.icon;
                return (
                  <button
                    key={p}
                    onClick={() => setPatternFilter(active ? "all" : p)}
                    disabled={count === 0}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all border ${
                      count === 0
                        ? "opacity-30 cursor-not-allowed bg-white/[0.04] border-transparent text-white/40"
                        : active
                          ? "cursor-pointer"
                          : "cursor-pointer bg-white/[0.04] border-transparent text-white/40 hover:text-white/70"
                    }`}
                    style={
                      active
                        ? { color: meta.color, background: meta.bg, borderColor: meta.border }
                        : undefined
                    }
                  >
                    <Icon size={11} />
                    {t(`references.patterns.${p}`)} · {count}
                  </button>
                );
              })}

              <div className="h-4 w-px bg-white/[0.08] mx-1" />

              {/* Tier */}
              {([
                { key: "all", label: t("references.tier.all") },
                { key: "mid", label: t("references.tier.midTop") },
                { key: "top", label: t("references.tier.top") },
              ] as { key: "all" | "mid" | "top"; label: string }[]).map((tier) => (
                <button
                  key={tier.key}
                  onClick={() => setTierFilter(tier.key)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                    tierFilter === tier.key
                      ? "bg-white/[0.1] text-white border border-white/[0.15]"
                      : "bg-white/[0.04] text-white/40 border border-transparent hover:text-white/70"
                  }`}
                >
                  {tier.label}
                </button>
              ))}

              <div className="h-4 w-px bg-white/[0.08] mx-1" />

              {/* Sort */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
                <ArrowUpDown size={11} className="text-muted-foreground" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="bg-transparent outline-none text-[11px] font-medium text-foreground/80 cursor-pointer pr-1"
                >
                  <option value="views">{t("references.sort.views")}</option>
                  <option value="likes">{t("references.sort.likes")}</option>
                  <option value="engagement">{t("references.sort.engagement")}</option>
                </select>
              </div>
            </div>

            {/* Hook grid */}
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[13px] text-white/30 font-light">
                  {t("references.noMatch")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((hook) => (
                  <HookCard
                    key={hook.id}
                    hook={hook}
                    workspaceId={workspaceId}
                    onAnalysisUpdate={handleAnalysisUpdate}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ─── Scraped profile/reel data type export (kept for API compat) ──────────────
export type { Reference, ScrapedProfile, ScrapedReel };
