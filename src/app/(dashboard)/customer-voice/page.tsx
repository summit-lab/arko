import { FileText, Phone, MessageSquare, TrendingUp, Quote, ChevronRight, Users, AlertCircle, ThumbsUp, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { GoalEditor } from "@/components/features/goals/GoalEditor";

const formResponses = [
  { question: "¿Qué te hizo comprarme?", topAnswer: "Tu contenido en Reels me demostró que sabías de lo que hablabas", count: 34 },
  { question: "¿Por qué yo y no otra persona?", topAnswer: "Porque mostrás resultados reales, no solo teoría", count: 28 },
  { question: "¿Cuál era tu mayor dolor antes?", topAnswer: "No saber qué contenido publicar para atraer clientes", count: 41 },
  { question: "¿Qué resultado obtuviste?", topAnswer: "Pasé de 0 a $15K/mes en 4 meses", count: 22 },
];

const callTranscripts = [
  {
    id: 1,
    prospect: "Lead - España",
    date: "Hace 1 día",
    duration: "28 min",
    sentiment: "positive" as const,
    keyPhrases: ["necesito escalar", "no tengo sistema", "vi tu Reel de errores"],
    summary: "Prospect cualificado. Factura $8K/mes, quiere llegar a $30K. Principal dolor: no tiene sistema de contenido.",
  },
  {
    id: 2,
    prospect: "Lead - México",
    date: "Hace 3 días",
    duration: "22 min",
    sentiment: "neutral" as const,
    keyPhrases: ["falta de tiempo", "muchas ideas pero no ejecuto", "competencia fuerte"],
    summary: "Semi-cualificado. Factura $5K/mes. Tiene resistencia al precio pero mucho interés en el sistema.",
  },
  {
    id: 3,
    prospect: "Lead - Argentina",
    date: "Hace 5 días",
    duration: "35 min",
    sentiment: "positive" as const,
    keyPhrases: ["quiero automatizar", "tu video de YouTube me convenció", "listo para invertir"],
    summary: "Altamente cualificado. Factura $22K/mes. Vio el video de YT y ya estaba decidido antes de la llamada.",
  },
];

const painPoints = [
  { pain: "No saber qué contenido publicar", mentions: 41, pct: 68 },
  { pain: "Falta de tiempo para crear contenido", mentions: 33, pct: 55 },
  { pain: "No poder medir el ROI del contenido", mentions: 28, pct: 47 },
  { pain: "Competencia creciente en su nicho", mentions: 19, pct: 32 },
  { pain: "No convertir seguidores en clientes", mentions: 24, pct: 40 },
];

const quotesForCopy = [
  "\"Vi tu Reel y supe que vos entendías mi problema\"",
  "\"En 3 meses recuperé la inversión x4\"",
  "\"Me ahorraste meses de prueba y error\"",
  "\"Tu contenido es el único que no se siente como humo\"",
];

export default async function CustomerVoicePage() {
  const workspaceId = await getWorkspaceId();
  let goals: { metric: string; target_value: number }[] = [];

  if (workspaceId) {
    const supabase = await createClient();
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

    const { data } = await supabase
      .from("workspace_goals")
      .select("metric, target_value")
      .eq("workspace_id", workspaceId)
      .eq("period_start", periodStart);

    goals = data ?? [];
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Customer Voice</h1>
          <p className="text-zinc-400 mt-1 text-sm">Lo que dicen tus prospectos y clientes. Data cualitativa pura.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white/10 border border-white/10 text-sm text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors">
            Sync Formularios
          </button>
          <button className="bg-white/10 border border-white/10 text-sm text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors">
            Subir Llamada
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Respuestas Formulario", value: "60", icon: FileText },
          { label: "Llamadas Transcritas", value: "23", icon: Phone },
          { label: "Dolores Detectados", value: "12", icon: AlertCircle },
          { label: "Frases para Copy", value: "34", icon: Quote },
        ].map((s) => (
          <div key={s.label} className="glass-panel rounded-xl p-4 text-center">
            <s.icon className="h-4 w-4 text-zinc-500 mx-auto mb-2" />
            <p className="text-lg font-bold text-white">{s.value}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Form Responses */}
        <div className="col-span-7 glass-panel rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <FileText className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-300">Respuestas de Formularios (Typeform)</h3>
          </div>
          <div className="space-y-4">
            {formResponses.map((r, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-zinc-300">{r.question}</p>
                  <span className="text-[10px] text-zinc-500">{r.count} respuestas</span>
                </div>
                <p className="text-sm text-zinc-400 italic">&ldquo;{r.topAnswer}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pain Points + Quotes */}
        <div className="col-span-5 space-y-6">
          {/* Pain Points */}
          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-zinc-300">Dolores Más Mencionados</h3>
            </div>
            <div className="space-y-3">
              {painPoints.map((p, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-300">{p.pain}</span>
                    <span className="text-[10px] text-zinc-500">{p.mentions}x ({p.pct}%)</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500/50" style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quotes for Copy */}
          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Quote className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-zinc-300">Frases para Copy</h3>
            </div>
            <div className="space-y-3">
              {quotesForCopy.map((q, i) => (
                <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/5 text-sm text-zinc-300 italic">
                  {q}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Goals */}
      <GoalEditor goals={goals} />

      {/* Call Transcripts */}
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-300">Llamadas de Venta Transcritas</h3>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar en transcripciones..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
        </div>

        <div className="space-y-3">
          {callTranscripts.map((call) => (
            <div key={call.id} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    call.sentiment === "positive" ? "bg-emerald-500/10" : "bg-zinc-500/10"
                  }`}>
                    {call.sentiment === "positive" ? (
                      <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Users className="h-3.5 w-3.5 text-zinc-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{call.prospect}</p>
                    <p className="text-[10px] text-zinc-500">{call.date} · {call.duration}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
              </div>
              <p className="text-xs text-zinc-400 mb-3">{call.summary}</p>
              <div className="flex flex-wrap gap-2">
                {call.keyPhrases.map((phrase, i) => (
                  <span key={i} className="text-[10px] px-2 py-1 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                    &ldquo;{phrase}&rdquo;
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
