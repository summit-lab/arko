"use client";

import { useState, useEffect } from "react";
import {
  Plus, ExternalLink, X, BookMarked, Loader2, Sparkles,
  RefreshCw, Users, Play, Heart, MessageCircle, CheckCircle2,
  ChevronDown, ChevronUp,
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

interface Reference {
  id: string;
  brand_name: string | null;
  brand_url: string | null;
  what_they_like: string | null;
  created_at: string;
  scraped_data: ScrapedProfile | null;
  scraped_reels: ScrapedReel[] | null;
  last_scraped_at: string | null;
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
    const parts = new URL(clean.startsWith("http") ? clean : `https://${clean}`)
      .pathname.split("/").filter(Boolean);
    return parts[0] ? `@${parts[0]}` : null;
  } catch { return null; }
}

function toIgUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const handle = url.startsWith("@") ? url.slice(1) : url;
  return `https://instagram.com/${handle}`;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const PALETTES = [
  { bg: "rgba(139,92,246,0.18)",  border: "rgba(139,92,246,0.35)",  text: "#a78bfa" },
  { bg: "rgba(56,189,248,0.15)",  border: "rgba(56,189,248,0.3)",   text: "#38bdf8" },
  { bg: "rgba(45,212,191,0.15)",  border: "rgba(45,212,191,0.3)",   text: "#2dd4bf" },
  { bg: "rgba(251,191,36,0.13)",  border: "rgba(251,191,36,0.28)",  text: "#fbbf24" },
  { bg: "rgba(251,113,133,0.15)", border: "rgba(251,113,133,0.3)",  text: "#fb7185" },
  { bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.3)",  text: "#c4b5fd" },
];

function palette(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return PALETTES[Math.abs(h) % PALETTES.length]!;
}

function Avatar({ url, name, size = 52 }: { url?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const p = palette(name);
  if (!url || failed) {
    return (
      <div className="shrink-0 flex items-center justify-center rounded-2xl font-light"
        style={{ width: size, height: size, background: p.bg, border: `1px solid ${p.border}`, color: p.text, fontSize: size * 0.4 }}>
        {name.trim().charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size}
      className="shrink-0 rounded-2xl object-cover"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)} />
  );
}

// ─── Reel thumbnail ───────────────────────────────────────────────────────────

function ReelThumb({ reel }: { reel: ScrapedReel }) {
  const [failed, setFailed] = useState(false);

  return (
    <a
      href={reel.permalink ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative rounded-xl overflow-hidden bg-zinc-900 block"
      style={{ aspectRatio: "9/16" }}
    >
      {reel.thumbnail_url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={reel.thumbnail_url} alt="" loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setFailed(true)} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Play size={16} className="text-white/10" />
        </div>
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%)" }} />
      {/* Stats */}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1.5">
        {reel.views_count != null && (
          <span className="flex items-center gap-0.5 text-[9px] text-white/70">
            <Play size={7} className="shrink-0" />{fmt(reel.views_count)}
          </span>
        )}
        {reel.likes_count != null && (
          <span className="flex items-center gap-0.5 text-[9px] text-white/70">
            <Heart size={7} className="shrink-0" />{fmt(reel.likes_count)}
          </span>
        )}
      </div>
    </a>
  );
}

// ─── Reference Card ───────────────────────────────────────────────────────────

function ReferenceCard({ reference, workspaceId, onDelete, onScrapeComplete }: {
  reference: Reference;
  workspaceId: string;
  onDelete: (id: string) => void;
  onScrapeComplete: (id: string, data: Partial<Reference>) => void;
}) {
  const [scraping, setScraping]         = useState(false);
  const [reelsOpen, setReelsOpen]       = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [confirmDel, setConfirmDel]     = useState(false);

  const name = reference.brand_name ?? "Sin nombre";
  const profile = reference.scraped_data;
  const reels = reference.scraped_reels ?? [];
  const handle = extractHandle(reference.brand_url);
  const igUrl = toIgUrl(reference.brand_url);
  const hasData = !!profile;
  const hasReels = reels.length > 0;

  async function handleScrape() {
    setScraping(true);
    try {
      const res = await fetch(`/api/v1/references/${reference.id}/scrape?workspace_id=${workspaceId}`, { method: "POST" });
      const json = await res.json() as { data?: { scraped_data: ScrapedProfile; scraped_reels: ScrapedReel[] } };
      if (res.ok && json.data) {
        onScrapeComplete(reference.id, {
          scraped_data: json.data.scraped_data,
          scraped_reels: json.data.scraped_reels,
          last_scraped_at: new Date().toISOString(),
        });
        setReelsOpen(true);
      }
    } finally {
      setScraping(false);
    }
  }

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    await fetch(`/api/v1/references/${reference.id}?workspace_id=${workspaceId}`, { method: "DELETE" });
    onDelete(reference.id);
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 100%)",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
      onMouseLeave={() => setConfirmDel(false)}
    >
      {/* ── Header: avatar + info ── */}
      <div className="p-4 flex gap-3.5">
        <Avatar
          url={profile?.ig_profile_pic_url}
          name={name}
          size={52}
        />

        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Name row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[15px] text-white/80 font-light leading-tight truncate">
                  {profile?.ig_full_name ?? name}
                </p>
                {profile?.ig_is_verified && (
                  <CheckCircle2 size={12} className="text-sky-400 shrink-0" />
                )}
              </div>
              {handle && (
                <p className="text-[11px] text-white/25 mt-0.5">{handle}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {igUrl && (
                <a href={igUrl} target="_blank" rel="noopener noreferrer"
                  className="h-7 w-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/[0.07]"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  <ExternalLink size={11} className="text-white/30" />
                </a>
              )}
              <button onClick={handleDelete} disabled={deleting}
                className="h-7 rounded-lg px-2 flex items-center gap-1 text-[10px] transition-all cursor-pointer disabled:opacity-30"
                style={confirmDel ? {
                  background: "rgba(251,113,133,0.15)", border: "1px solid rgba(251,113,133,0.3)", color: "#fb7185",
                } : { border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.2)" }}>
                {deleting ? <Loader2 size={9} className="animate-spin" /> : <X size={9} />}
                {confirmDel && <span>Confirmar</span>}
              </button>
            </div>
          </div>

          {/* Followers + posts */}
          {profile && (
            <div className="flex items-center gap-3">
              {profile.ig_follower_count != null && (
                <span className="flex items-center gap-1 text-[11px] text-white/40">
                  <Users size={10} className="text-white/20" />
                  {fmt(profile.ig_follower_count)} seguidores
                </span>
              )}
              {profile.ig_post_count != null && (
                <span className="text-[11px] text-white/25">
                  {profile.ig_post_count} posts
                </span>
              )}
              {profile.ig_business_category && (
                <span className="text-[10px] text-white/20 truncate">
                  {profile.ig_business_category}
                </span>
              )}
            </div>
          )}

          {/* Bio */}
          {profile?.ig_bio && (
            <p className="text-[11px] text-white/35 font-light leading-relaxed line-clamp-2">
              {profile.ig_bio}
            </p>
          )}
        </div>
      </div>

      {/* ── "Por qué me inspira" note ── */}
      {reference.what_they_like && (
        <div className="px-4 pb-3">
          <div className="rounded-xl px-3 py-2.5"
            style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.15)" }}>
            <p className="text-[10px] text-violet-400/50 uppercase tracking-wider mb-1">Por qué inspira</p>
            <p className="text-[12px] text-white/50 font-light leading-relaxed italic">
              "{reference.what_they_like}"
            </p>
          </div>
        </div>
      )}

      {/* ── Footer: scrape button + reels toggle ── */}
      <div className="px-4 pb-4 flex items-center gap-2">
        {/* Scrape / Re-scrape */}
        {reference.brand_url ? (
          <button onClick={handleScrape} disabled={scraping}
            className="flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-medium transition-all cursor-pointer disabled:opacity-40"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "rgba(255,255,255,0.35)",
            }}>
            {scraping
              ? <><Loader2 size={10} className="animate-spin" /> Scrapeando…</>
              : <><RefreshCw size={10} />{hasData ? "Re-scrapear" : "Ver perfil y reels"}</>
            }
          </button>
        ) : null}

        {/* Toggle reels */}
        {hasReels && (
          <button onClick={() => setReelsOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-medium transition-all cursor-pointer ml-auto"
            style={{
              background: reelsOpen ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "rgba(255,255,255,0.4)",
            }}>
            <Play size={9} />
            {reels.length} reels
            {reelsOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}
      </div>

      {/* ── Reels grid (collapsible) ── */}
      {hasReels && reelsOpen && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-4 gap-2">
            {reels.slice(0, 8).map((reel, i) => (
              <ReelThumb key={reel.short_code ?? i} reel={reel} />
            ))}
          </div>
          {reels.length > 8 && (
            <p className="text-[10px] text-white/20 text-center mt-2">
              +{reels.length - 8} reels más
            </p>
          )}
        </div>
      )}

      {/* No URL hint */}
      {!reference.brand_url && !hasData && (
        <div className="px-4 pb-4">
          <p className="text-[10px] text-white/20 font-light">
            Agregá una URL de Instagram para ver el perfil y reels
          </p>
        </div>
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
    if (!brandName.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/v1/references?workspace_id=${workspaceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_name: brandName, brand_url: brandUrl || null, what_they_like: whatTheyLike || null }),
      });
      const json = await res.json() as { data?: { reference: Reference }; message?: string };
      if (!res.ok) { setError(json.message ?? "Error guardando"); return; }
      onSave(json.data!.reference);
      onClose();
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12, padding: "10px 14px", color: "rgba(255,255,255,0.8)",
    fontSize: 13, outline: "none", width: "100%", fontFamily: "inherit",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
      onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: "rgba(10,10,20,0.98)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-violet-400" />
            <p className="text-[14px] text-white/80 font-light">Agregar referencia</p>
          </div>
          <button onClick={onClose}
            className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/[0.07] transition-all cursor-pointer"
            style={{ border: "1px solid rgba(255,255,255,0.09)" }}>
            <X size={12} className="text-white/40" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] text-white/30 uppercase tracking-wider">Nombre *</label>
            <input style={inputStyle} placeholder="ej: Gary Vee, Alex Hormozi…"
              value={brandName} onChange={(e) => setBrandName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-white/30 uppercase tracking-wider">Instagram (opcional)</label>
            <input style={inputStyle} placeholder="@handle o https://instagram.com/…"
              value={brandUrl} onChange={(e) => setBrandUrl(e.target.value)} />
            <p className="text-[10px] text-white/20 px-1">Con el handle podés scrapear el perfil y reels</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-white/30 uppercase tracking-wider">¿Por qué te inspira?</label>
            <textarea style={{ ...inputStyle, resize: "none", minHeight: 80 }}
              placeholder="Su estilo, cómo comunica, qué te copa de su contenido…"
              value={whatTheyLike} onChange={(e) => setWhatTheyLike(e.target.value)} />
          </div>
          {error && <p className="text-[11px] text-rose-400">{error}</p>}
          <button type="submit" disabled={saving || !brandName.trim()}
            className="w-full h-10 rounded-xl text-[13px] font-medium transition-all cursor-pointer disabled:opacity-40"
            style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.35)", color: "#c4b5fd" }}>
            {saving
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={12} className="animate-spin" /> Guardando…</span>
              : "Guardar referencia"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="py-20 flex flex-col items-center gap-5">
      <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)" }}>
        <BookMarked size={24} className="text-violet-400/50" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-white/40 font-light text-[15px]">Sin referencias todavía</p>
        <p className="text-white/20 text-[12px] font-light max-w-xs">
          Agregá las marcas y creadores que te inspiran — con su Instagram podés ver su perfil y reels recientes
        </p>
      </div>
      <button onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium transition-all cursor-pointer"
        style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#c4b5fd" }}>
        <Plus size={13} /> Agregar primera referencia
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReferencesTab({ workspaceId, initialReferences }: { workspaceId: string | null; initialReferences?: Reference[] }) {
  const [references, setReferences] = useState<Reference[]>(initialReferences ?? []);
  const [loading, setLoading]       = useState(false);
  const [showModal, setShowModal]   = useState(false);

  function handleSave(ref: Reference) {
    setReferences((prev) => [...prev, ref]);
  }

  function handleDelete(id: string) {
    setReferences((prev) => prev.filter((r) => r.id !== id));
  }

  function handleScrapeComplete(id: string, data: Partial<Reference>) {
    setReferences((prev) => prev.map((r) => r.id === id ? { ...r, ...data } : r));
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-40 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)" }} />
        ))}
      </div>
    );
  }

  return (
    <>
      {showModal && workspaceId && (
        <AddModal onClose={() => setShowModal(false)} onSave={handleSave} workspaceId={workspaceId} />
      )}

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-white/50 font-light">Marcas y creadores que te inspiran</p>
            {references.length > 0 && (
              <p className="text-[11px] text-white/20 mt-0.5">
                {references.length} referencia{references.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          {references.length > 0 && (
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-medium transition-all cursor-pointer"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
              <Plus size={13} /> Agregar
            </button>
          )}
        </div>

        {references.length === 0 ? (
          <EmptyState onAdd={() => setShowModal(true)} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {references.map((ref) => (
              <ReferenceCard
                key={ref.id}
                reference={ref}
                workspaceId={workspaceId!}
                onDelete={handleDelete}
                onScrapeComplete={handleScrapeComplete}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
