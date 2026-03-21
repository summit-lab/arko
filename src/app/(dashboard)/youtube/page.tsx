import { Eye, ThumbsUp, MessageSquare, Clock, ChevronRight, Play, BarChart3, Timer, MousePointerClick } from "lucide-react";

const videos = [
  {
    id: 1,
    title: "Cómo facturé $100K en 90 días con marca personal",
    date: "Hace 3 días",
    views: "45K",
    likes: "2.3K",
    comments: "312",
    watchTime: "8:42",
    ctr: "12.4%",
    avgRetention: "44%",
    duration: "18:23",
    status: "trending" as const,
  },
  {
    id: 2,
    title: "El sistema exacto que uso para crear contenido",
    date: "Hace 12 días",
    views: "32K",
    likes: "1.8K",
    comments: "198",
    watchTime: "6:15",
    ctr: "9.8%",
    avgRetention: "38%",
    duration: "15:47",
    status: "normal" as const,
  },
  {
    id: 3,
    title: "Por qué la mayoría fracasa vendiendo online",
    date: "Hace 22 días",
    views: "28K",
    likes: "1.4K",
    comments: "156",
    watchTime: "5:30",
    ctr: "8.2%",
    avgRetention: "35%",
    duration: "14:12",
    status: "normal" as const,
  },
  {
    id: 4,
    title: "Mi stack tecnológico para escalar",
    date: "Hace 1 mes",
    views: "18K",
    likes: "980",
    comments: "87",
    watchTime: "4:10",
    ctr: "6.5%",
    avgRetention: "31%",
    duration: "12:05",
    status: "low" as const,
  },
];

const insights = [
  { type: "success" as const, text: "El CTR del último video es 26% mayor que tu promedio. El thumbnail está funcionando." },
  { type: "info" as const, text: "Los videos de 15-18 min tienen mejor watch time que los de +20 min." },
  { type: "warning" as const, text: "La retención cae un 30% después del minuto 6. Considerar reestructurar la mitad del video." },
];

export default function YouTubePage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">YT Intelligence</h1>
          <p className="text-zinc-400 mt-1 text-sm">Análisis profundo de tus videos de YouTube.</p>
        </div>
        <button className="bg-white/10 border border-white/10 text-sm text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors">
          Sincronizar Videos
        </button>
      </div>

      {/* AI Insights */}
      <div className="glass-panel rounded-2xl p-4">
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          {insights.map((insight, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 shrink-0 px-4 py-2 rounded-lg border text-xs ${
                insight.type === "warning"
                  ? "border-amber-500/20 bg-amber-500/5 text-amber-300"
                  : insight.type === "success"
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
                  : "border-blue-500/20 bg-blue-500/5 text-blue-300"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {insight.text}
            </div>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Views Totales", value: "123K", icon: Eye },
          { label: "Likes", value: "6.5K", icon: ThumbsUp },
          { label: "Comentarios", value: "753", icon: MessageSquare },
          { label: "CTR Promedio", value: "9.2%", icon: MousePointerClick },
          { label: "Watch Time Avg", value: "6:09", icon: Timer },
        ].map((s) => (
          <div key={s.label} className="glass-panel rounded-xl p-4 text-center">
            <s.icon className="h-4 w-4 text-zinc-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-white">{s.value}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Videos List */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-zinc-300">Últimos Videos</h3>
          <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-400 outline-none">
            <option className="bg-zinc-900">Más recientes</option>
            <option className="bg-zinc-900">Más views</option>
            <option className="bg-zinc-900">Mejor retención</option>
          </select>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-3 text-[10px] text-zinc-500 uppercase tracking-wider pb-2 border-b border-white/5 px-2">
            <div className="col-span-4">Video</div>
            <div className="col-span-1 text-center">Views</div>
            <div className="col-span-1 text-center">Likes</div>
            <div className="col-span-1 text-center">Comments</div>
            <div className="col-span-1 text-center">CTR</div>
            <div className="col-span-1 text-center">Watch Time</div>
            <div className="col-span-1 text-center">Retención</div>
            <div className="col-span-1 text-center">Duración</div>
            <div className="col-span-1"></div>
          </div>

          {videos.map((video) => (
            <div
              key={video.id}
              className="grid grid-cols-12 gap-3 items-center py-3.5 px-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
            >
              <div className="col-span-4 flex items-center gap-3">
                <div className="h-12 w-20 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-white/10 flex items-center justify-center shrink-0 relative">
                  <Play className="h-4 w-4 text-white/60" />
                  {video.status === "trending" && (
                    <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 border border-black animate-pulse" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200 truncate group-hover:text-white transition-colors">{video.title}</p>
                  <p className="text-[10px] text-zinc-500">{video.date}</p>
                </div>
              </div>
              <div className="col-span-1 text-center text-xs font-medium text-zinc-300">{video.views}</div>
              <div className="col-span-1 text-center text-xs text-zinc-400">{video.likes}</div>
              <div className="col-span-1 text-center text-xs text-zinc-400">{video.comments}</div>
              <div className="col-span-1 text-center">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  parseFloat(video.ctr) >= 10
                    ? "text-emerald-400 bg-emerald-400/10"
                    : parseFloat(video.ctr) >= 7
                    ? "text-blue-400 bg-blue-400/10"
                    : "text-amber-400 bg-amber-400/10"
                }`}>
                  {video.ctr}
                </span>
              </div>
              <div className="col-span-1 text-center text-xs text-zinc-400">{video.watchTime}</div>
              <div className="col-span-1 text-center">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  parseInt(video.avgRetention) >= 40
                    ? "text-emerald-400 bg-emerald-400/10"
                    : parseInt(video.avgRetention) >= 33
                    ? "text-blue-400 bg-blue-400/10"
                    : "text-amber-400 bg-amber-400/10"
                }`}>
                  {video.avgRetention}
                </span>
              </div>
              <div className="col-span-1 text-center flex items-center justify-center gap-1">
                <Clock className="h-3 w-3 text-zinc-500" />
                <span className="text-xs text-zinc-400">{video.duration}</span>
              </div>
              <div className="col-span-1 text-right">
                <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300 transition-colors ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
