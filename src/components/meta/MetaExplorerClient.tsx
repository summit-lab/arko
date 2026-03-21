"use client";

import { useState } from "react";
import { Send, Copy, Clock, Zap, ChevronDown, ChevronUp } from "lucide-react";

interface ExplorerResponse {
  data?: {
    meta_status: number;
    elapsed_ms: number;
    resolved_url: string;
    connection_context: {
      ig_business_account_id: string | null;
      ig_username: string | null;
      fb_user_id: string | null;
      page_id: string | null;
      page_name: string | null;
    };
    response: unknown;
  };
  error?: string;
  message?: string;
}

interface Preset {
  label: string;
  description: string;
  path: string;
  params: Record<string, string>;
}

const MEDIA_INSIGHT_PERIODS = ["day", "week", "days_28", "month", "lifetime", "total_over_range"];

const MEDIA_INSIGHT_BREAKDOWNS = [
  {
    metric: "profile_activity",
    breakdown: "action_type",
    values: ["bio_link_clicked", "call", "direction", "email", "other", "text"],
  },
  {
    metric: "navigation",
    breakdown: "story_navigation_action_type",
    values: ["swipe_forward", "tap_back", "tap_exit", "tap_forward"],
  },
];

const MEDIA_INSIGHT_METRICS = [
  { name: "comments", mediaTypes: "FEED, REELS", status: "active" },
  { name: "follows", mediaTypes: "FEED, STORY", status: "active" },
  { name: "ig_reels_avg_watch_time", mediaTypes: "REELS", status: "active" },
  { name: "ig_reels_video_view_total_time", mediaTypes: "REELS", status: "active" },
  { name: "likes", mediaTypes: "FEED, REELS", status: "active" },
  { name: "navigation", mediaTypes: "STORY", status: "active" },
  { name: "profile_activity", mediaTypes: "FEED, STORY", status: "active" },
  { name: "profile_visits", mediaTypes: "FEED, STORY", status: "active" },
  { name: "reach", mediaTypes: "FEED, REELS, STORY", status: "active" },
  { name: "replies", mediaTypes: "STORY", status: "active" },
  { name: "saved", mediaTypes: "FEED, REELS", status: "active" },
  { name: "shares", mediaTypes: "FEED, REELS, STORY", status: "active" },
  { name: "total_interactions", mediaTypes: "FEED, REELS, STORY", status: "active" },
  { name: "views", mediaTypes: "FEED, REELS, STORY", status: "active" },
  { name: "impressions", mediaTypes: "FEED, STORY", status: "deprecated" },
  { name: "plays", mediaTypes: "REELS", status: "deprecated" },
  { name: "clips_replays_count", mediaTypes: "REELS", status: "deprecated" },
  { name: "ig_reels_aggregated_all_plays_count", mediaTypes: "REELS", status: "deprecated" },
  { name: "video_views", mediaTypes: "legacy", status: "deprecated" },
];

const PRESETS: Preset[] = [
  {
    label: "Media (Reels + Posts)",
    description: "Lista de medios con fields válidos del media object",
    path: "/{ig_account_id}/media",
    params: {
      fields: "id,caption,media_type,media_product_type,permalink,media_url,thumbnail_url,timestamp,is_shared_to_feed,like_count,comments_count",
      limit: "5",
    },
  },
  {
    label: "Un Reel — Insights recomendados",
    description: "Métricas activas para REELS según docs actuales",
    path: "/{media_id}/insights",
    params: {
      metric: "views,reach,likes,comments,shares,saved,total_interactions,ig_reels_avg_watch_time,ig_reels_video_view_total_time",
      period: "lifetime",
    },
  },
  {
    label: "Un Reel — Insights con deprecated",
    description: "Incluye impressions para probar compatibilidad en media vieja",
    path: "/{media_id}/insights",
    params: {
      metric: "views,reach,likes,comments,shares,saved,total_interactions,ig_reels_avg_watch_time,ig_reels_video_view_total_time,impressions",
      period: "lifetime",
    },
  },
  {
    label: "Un Post — Insights recomendados",
    description: "Métricas activas para FEED según docs actuales",
    path: "/{media_id}/insights",
    params: {
      metric: "views,reach,likes,comments,shares,saved,total_interactions,profile_activity,profile_visits,follows",
      period: "lifetime",
    },
  },
  {
    label: "Una Story — Navigation breakdown",
    description: "Ejemplo válido de breakdown para STORY",
    path: "/{media_id}/insights",
    params: {
      metric: "navigation",
      breakdown: "story_navigation_action_type",
      period: "lifetime",
    },
  },
  {
    label: "Un Post — Profile activity breakdown",
    description: "Ejemplo válido de breakdown action_type",
    path: "/{media_id}/insights",
    params: {
      metric: "profile_activity",
      breakdown: "action_type",
      period: "lifetime",
    },
  },
  {
    label: "Un Media — Fields directos",
    description: "Campos del media object (no insights)",
    path: "/{media_id}",
    params: {
      fields: "id,caption,media_type,media_product_type,permalink,media_url,thumbnail_url,timestamp,is_shared_to_feed,like_count,comments_count,shortcode",
    },
  },
  {
    label: "IG Account Info",
    description: "Info de la cuenta de Instagram Business",
    path: "/{ig_account_id}",
    params: {
      fields: "id,name,username,biography,followers_count,follows_count,media_count,profile_picture_url,website",
    },
  },
  {
    label: "IG Account Insights (día)",
    description: "Insights de cuenta — últimos 7 días",
    path: "/{ig_account_id}/insights",
    params: {
      metric: "impressions,reach,accounts_engaged,total_interactions,likes,comments,shares,saves,replies,follows_and_unfollows,profile_views",
      period: "day",
      since: String(Math.floor((Date.now() - 7 * 86400000) / 1000)),
      until: String(Math.floor(Date.now() / 1000)),
    },
  },
];

interface MetaExplorerClientProps {
  workspaceId: string;
  initialConnection: {
    ig_business_account_id: string | null;
    ig_username: string | null;
    fb_user_id: string | null;
    page_id: string | null;
    page_name: string | null;
  };
  recentMedia: Array<{
    mediaId: string;
    caption: string;
    publishedAt: string | null;
  }>;
}

function truncateCaption(value: string, maxLength = 72): string {
  if (!value) return "Sin caption";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

export function MetaExplorerClient({ workspaceId, initialConnection, recentMedia }: MetaExplorerClientProps) {
  const [path, setPath] = useState("/{ig_account_id}/media");
  const [paramsText, setParamsText] = useState(
    JSON.stringify({
      fields: "id,caption,media_type,media_product_type,permalink,media_url,thumbnail_url,timestamp,is_shared_to_feed,like_count,comments_count",
      limit: "5",
    }, null, 2),
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExplorerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  function applyPreset(preset: Preset) {
    setPath(preset.path);
    setParamsText(JSON.stringify(preset.params, null, 2));
    setResult(null);
    setError(null);
  }

  function applyMediaId(mediaId: string) {
    setPath((currentPath) => {
      if (currentPath.includes("{media_id}")) {
        return currentPath.replace(/\{media_id\}/g, mediaId);
      }

      const normalized = currentPath.trim();
      if (!normalized || normalized === "/") {
        return `/${mediaId}`;
      }

      return `/${mediaId}`;
    });
  }

  async function handleSubmit() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      let finalParams: Record<string, string>;
      try {
        finalParams = JSON.parse(paramsText) as Record<string, string>;
      } catch {
        setError("JSON de params inválido");
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/v1/meta/explorer?workspace_id=${workspaceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, params: finalParams }),
      });

      const json = await res.json() as ExplorerResponse;
      setResult(json);

      if (!res.ok) {
        setError(json.message || json.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function copyResponse() {
    if (!result?.data?.response) return;
    await navigator.clipboard.writeText(JSON.stringify(result.data.response, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const responseJson = result?.data?.response
    ? JSON.stringify(result.data.response, null, 2)
    : null;
  const connectionContext = result?.data?.connection_context ?? initialConnection;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Meta API Explorer</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Hacé requests directas a la Graph API de Meta para ver exactamente qué datos devuelve.
          Los placeholders <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-violet-300">{"{ig_account_id}"}</code> y <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-violet-300">{"{fb_user_id}"}</code> se reemplazan automáticamente.
        </p>
      </div>

      {connectionContext && (
        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4 backdrop-blur-xl">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-emerald-300">Cuenta conectada</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <p className="text-[11px] text-zinc-500">IG Username</p>
              <p className="font-mono text-sm text-white">{connectionContext.ig_username || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">IG Account ID</p>
              <p className="font-mono text-sm text-white">{connectionContext.ig_business_account_id || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">Page Name</p>
              <p className="text-sm text-white">{connectionContext.page_name || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">Page ID</p>
              <p className="font-mono text-sm text-white">{connectionContext.page_id || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">FB User ID</p>
              <p className="font-mono text-sm text-white">{connectionContext.fb_user_id || "—"}</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4 backdrop-blur-xl">
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-amber-300">Instagram Media Insights Reference</p>
            <p className="mt-1 text-xs text-zinc-400"><code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-amber-200">/{"{media_id}"}/insights</code> usa <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-amber-200">metric</code> obligatorio. <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-amber-200">period</code> admite {MEDIA_INSIGHT_PERIODS.join(", ")}. Para media insights, Meta suele responder <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-amber-200">lifetime</code>.</p>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Métricas disponibles</p>
            <div className="flex flex-wrap gap-2">
              {MEDIA_INSIGHT_METRICS.map((metric) => (
                <span
                  key={metric.name}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${metric.status === "deprecated" ? "border-red-500/20 bg-red-500/5 text-red-300" : "border-white/10 bg-white/5 text-zinc-200"}`}
                >
                  {metric.name} · {metric.mediaTypes}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Breakdowns válidos</p>
              <div className="space-y-2">
                {MEDIA_INSIGHT_BREAKDOWNS.map((item) => (
                  <div key={`${item.metric}-${item.breakdown}`} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-300">
                    <p><span className="text-white">metric:</span> <span className="font-mono">{item.metric}</span></p>
                    <p><span className="text-white">breakdown:</span> <span className="font-mono">{item.breakdown}</span></p>
                    <p className="mt-1 text-zinc-500">values: {item.values.join(", ")}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Notas de compatibilidad</p>
              <div className="space-y-2 text-xs text-zinc-300">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  `impressions` está deprecated y puede fallar para contenido creado después del 2024-07-02.
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  `plays`, `clips_replays_count`, `ig_reels_aggregated_all_plays_count` y `video_views` no deberían usarse como default.
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  Si pedís un breakdown para una métrica no compatible, Meta devuelve error.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {recentMedia.length > 0 && (
        <div className="rounded-2xl border border-sky-500/15 bg-sky-500/5 p-4 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-sky-300">Media IDs recientes</p>
              <p className="text-xs text-zinc-400">Hacé click para insertar el `media_id` en el path actual.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            {recentMedia.map((media) => (
              <button
                key={media.mediaId}
                onClick={() => applyMediaId(media.mediaId)}
                className="rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-colors hover:bg-white/10 hover:border-sky-500/30"
              >
                <p className="font-mono text-xs text-sky-300">{media.mediaId}</p>
                <p className="mt-1 text-xs text-zinc-200">{truncateCaption(media.caption)}</p>
                <p className="mt-1 text-[11px] text-zinc-500">{media.publishedAt ? new Date(media.publishedAt).toLocaleString("es-AR") : "Sin fecha"}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Presets */}
      <div className="rounded-2xl border border-white/10 bg-black/35 backdrop-blur-xl">
        <button
          onClick={() => setPresetsOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">Queries preset</span>
            <span className="text-xs text-zinc-500">({PRESETS.length} disponibles)</span>
          </div>
          {presetsOpen ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
        </button>
        {presetsOpen && (
          <div className="border-t border-white/5 px-5 pb-5 pt-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className="rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-colors hover:bg-white/10 hover:border-violet-500/30"
                >
                  <p className="text-xs font-semibold text-white">{preset.label}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">{preset.description}</p>
                  <p className="mt-1.5 font-mono text-[10px] text-violet-300 truncate">{preset.path}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Request builder */}
      <div className="rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Path (Graph API endpoint)
          </label>
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 rounded bg-white/10 px-2.5 py-2 text-xs font-mono text-zinc-400">
              graph.facebook.com/v25.0
            </span>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/{ig_account_id}/media"
              className="flex-1 rounded-lg border border-white/10 bg-black/50 px-3 py-2 font-mono text-sm text-white placeholder-zinc-600 focus:border-violet-500/50 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Params (JSON)
          </label>
          <textarea
            value={paramsText}
            onChange={(e) => setParamsText(e.target.value)}
            rows={6}
            spellCheck={false}
            className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 font-mono text-xs text-white placeholder-zinc-600 focus:border-violet-500/50 focus:outline-none resize-y"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || !path}
            className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            <Send className="h-4 w-4" />
            {loading ? "Ejecutando..." : "Ejecutar"}
          </button>

          {result?.data && (
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className={`font-semibold ${result.data.meta_status === 200 ? "text-emerald-400" : "text-red-400"}`}>
                HTTP {result.data.meta_status}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {result.data.elapsed_ms}ms
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Response */}
      {result?.data && (
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-xl">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1">URL resuelta</p>
            <p className="font-mono text-xs text-zinc-300 break-all">{result.data.resolved_url}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-xl">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1">Conexión</p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="text-zinc-400">IG: <span className="text-white font-mono">{result.data.connection_context.ig_business_account_id || "—"}</span></span>
              <span className="text-zinc-400">@IG: <span className="text-white font-mono">{result.data.connection_context.ig_username || "—"}</span></span>
              <span className="text-zinc-400">FB User: <span className="text-white font-mono">{result.data.connection_context.fb_user_id || "—"}</span></span>
              <span className="text-zinc-400">Page: <span className="text-white font-mono">{result.data.connection_context.page_id || "—"}</span></span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/35 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Respuesta JSON</p>
              <button
                onClick={copyResponse}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-white/10 transition-colors"
              >
                <Copy className="h-3 w-3" />
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
            <pre className="overflow-auto p-4 text-xs text-zinc-300 max-h-[600px] leading-relaxed">
              {responseJson}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
