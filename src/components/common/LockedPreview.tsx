import { Eye, Users, Heart, TrendingUp, Play, ArrowUpRight, ArrowDownRight } from "lucide-react";

/**
 * Mock PREMIUM del contenido de una pantalla (KPIs + gráfico + listados).
 *
 * Se renderiza BORROSO detrás del candado en `FeatureLock variant="page"`:
 * en vez de un fondo blanco vacío, la pantalla bloqueada deja entrever un
 * dashboard rico ("hay algo potente acá, pero está bloqueado"), estilo paywall
 * frosted-glass. Es puramente decorativo — `aria-hidden`, no interactivo — y
 * usa las utilidades del design system (`glass-card`, `stat-label`, tokens de
 * color) para adaptarse solo a light/dark.
 *
 * Datos inventados a propósito (genéricos de analytics) para que quede premium
 * en TODAS las pantallas bloqueadas (Espía, Tu audiencia, Ventas, etc.).
 */

const KPIS = [
  { label: "Vistas", value: "48.2K", delta: "+12.4%", up: true, Icon: Eye },
  { label: "Seguidores", value: "6.727", delta: "+3.1%", up: true, Icon: Users },
  { label: "Engagement", value: "5.8%", delta: "+0.6%", up: true, Icon: Heart },
  { label: "Alcance", value: "112K", delta: "−2.0%", up: false, Icon: TrendingUp },
];

const LINE =
  "M0,95 C30,80 55,55 90,62 C125,69 150,30 190,40 C230,50 255,22 300,30 C345,38 370,60 410,48 C430,42 445,50 450,46";
const AREA = `${LINE} L450,140 L0,140 Z`;

const ROWS = [
  { n: "24.1K", w: "78%" },
  { n: "18.9K", w: "64%" },
  { n: "12.4K", w: "52%" },
  { n: "9.7K", w: "41%" },
];

const BARS = [62, 80, 45, 90, 70, 55, 84];
const TABLE = [5, 4, 5, 3, 4];

function Spark({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 60 20" className="w-14 h-5" preserveAspectRatio="none">
      <path
        d={up ? "M0,16 L15,12 L30,14 L45,5 L60,2" : "M0,4 L15,8 L30,6 L45,13 L60,16"}
        fill="none"
        stroke={up ? "rgb(52,211,153)" : "rgb(251,113,133)"}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LockedPreview() {
  return (
    <div className="p-6 sm:p-8 space-y-5 origin-top scale-[1.04]">
      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <div className="h-8 w-52 rounded-md bg-foreground/10" />
          <div className="mt-2.5 h-3 w-72 rounded bg-foreground/[0.06]" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 rounded-lg bg-foreground/[0.06] border border-border" />
          <div className="h-9 w-24 rounded-lg bg-foreground/[0.06] border border-border" />
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-4 gap-4">
        {KPIS.map(({ label, value, delta, up, Icon }) => (
          <div key={label} className="glass-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="stat-label">{label}</span>
              <Icon size={15} className="text-muted-foreground" />
            </div>
            <div className="flex items-end justify-between gap-2">
              <div>
                <div className="text-[26px] font-light leading-none tracking-tight text-foreground">{value}</div>
                <div
                  className={`mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-medium ${
                    up ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {delta}
                </div>
              </div>
              <Spark up={up} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Gráfico principal ── */}
      <div className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="h-4 w-44 rounded bg-foreground/10" />
            <div className="mt-2 h-2.5 w-28 rounded bg-foreground/[0.06]" />
          </div>
          <div className="flex gap-2">
            <div className="h-6 w-16 rounded-md bg-violet-500/20" />
            <div className="h-6 w-16 rounded-md bg-foreground/[0.06]" />
            <div className="h-6 w-16 rounded-md bg-foreground/[0.06]" />
          </div>
        </div>
        <svg viewBox="0 0 450 140" className="h-44 w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lp-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(139,92,246,0.40)" />
              <stop offset="100%" stopColor="rgba(139,92,246,0)" />
            </linearGradient>
          </defs>
          <path d={AREA} fill="url(#lp-fill)" />
          <path
            d={LINE}
            fill="none"
            stroke="rgb(139,92,246)"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="neon-line-violet"
          />
        </svg>
      </div>

      {/* ── Listado + barras ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card col-span-2 space-y-4 p-5">
          <div className="h-4 w-40 rounded bg-foreground/10" />
          {ROWS.map((r, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.08]">
                <Play size={15} className="text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="h-3 rounded bg-foreground/10" style={{ width: r.w }} />
                <div className="mt-2 h-2.5 w-1/4 rounded bg-foreground/[0.06]" />
              </div>
              <div className="text-[15px] font-medium text-foreground/80">{r.n}</div>
            </div>
          ))}
        </div>
        <div className="glass-card p-5">
          <div className="mb-4 h-4 w-24 rounded bg-foreground/10" />
          <div className="flex h-32 items-end justify-between gap-2">
            {BARS.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-gradient-to-t from-violet-500/25 to-violet-400/70"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-4 w-36 rounded bg-foreground/10" />
          <div className="h-7 w-24 rounded-lg bg-foreground/[0.06]" />
        </div>
        <div className="space-y-3.5">
          {TABLE.map((cols, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-8 w-8 shrink-0 rounded-full bg-foreground/[0.08]" />
              <div className="h-3 w-1/4 rounded bg-foreground/10" />
              <div className="h-3 flex-1 rounded bg-foreground/[0.05]" />
              {Array.from({ length: cols }).map((_, j) => (
                <div key={j} className="hidden h-3 w-12 rounded bg-foreground/[0.07] md:block" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
