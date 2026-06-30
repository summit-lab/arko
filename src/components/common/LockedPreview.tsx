import {
  Eye, Users, Heart, TrendingUp, Play, ArrowUpRight, ArrowDownRight,
  DollarSign, Bot,
} from "lucide-react";

/**
 * Mock PREMIUM del contenido de una pantalla, por feature. Se renderiza BORROSO
 * detrás del candado en `FeatureLock variant="page"`: en vez de fondo vacío, la
 * pantalla bloqueada deja entrever un layout rico y ACORDE a la feature
 * (paywall frosted-glass). Puramente decorativo (`aria-hidden`, no interactivo).
 *
 * Respeta los márgenes de la app (px-8 py-10, como las páginas reales) y usa
 * tokens del design system → se adapta solo a light/dark. Datos inventados.
 */

export type PreviewKind = "metrics" | "competitors" | "audience" | "sales" | "board" | "chat";

// ─── Átomos ───────────────────────────────────────────────────────────────
const skel = "rounded bg-foreground/10";
const skelSoft = "rounded bg-foreground/[0.06]";

function PageHeader() {
  return (
    <div className="mb-7 flex items-start justify-between">
      <div>
        <div className={`h-7 w-56 ${skel}`} />
        <div className={`mt-3 h-3 w-80 ${skelSoft}`} />
      </div>
      <div className="flex gap-2">
        <div className="h-9 w-32 rounded-lg border border-border bg-foreground/[0.05]" />
        <div className="h-9 w-9 rounded-lg border border-border bg-foreground/[0.05]" />
      </div>
    </div>
  );
}

function Spark({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 60 20" className="h-5 w-14" preserveAspectRatio="none">
      <path
        d={up ? "M0,16 L15,12 L30,14 L45,5 L60,2" : "M0,4 L15,8 L30,6 L45,13 L60,16"}
        fill="none" strokeWidth="2" strokeLinecap="round"
        stroke={up ? "rgb(52,211,153)" : "rgb(251,113,133)"}
      />
    </svg>
  );
}

function KpiCard({ label, value, delta, up, Icon }: {
  label: string; value: string; delta: string; up: boolean;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="glass-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="stat-label">{label}</span>
        <Icon size={15} className="text-muted-foreground" />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-[26px] font-light leading-none tracking-tight text-foreground">{value}</div>
          <div className={`mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-medium ${up ? "text-emerald-400" : "text-rose-400"}`}>
            {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{delta}
          </div>
        </div>
        <Spark up={up} />
      </div>
    </div>
  );
}

const AREA_LINE = "M0,95 C30,80 55,55 90,62 C125,69 150,30 190,40 C230,50 255,22 300,30 C345,38 370,60 410,48 C430,42 445,50 450,46";
function AreaChart() {
  return (
    <svg viewBox="0 0 450 140" className="h-44 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lp-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(139,92,246,0.40)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0)" />
        </linearGradient>
      </defs>
      <path d={`${AREA_LINE} L450,140 L0,140 Z`} fill="url(#lp-fill)" />
      <path d={AREA_LINE} fill="none" stroke="rgb(139,92,246)" strokeWidth="2.5" strokeLinecap="round" className="neon-line-violet" />
    </svg>
  );
}

function Donut() {
  return (
    <svg viewBox="0 0 36 36" className="h-32 w-32">
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(127,127,127,0.12)" strokeWidth="4" />
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgb(139,92,246)" strokeWidth="4" strokeDasharray="62 100" strokeLinecap="round" transform="rotate(-90 18 18)" />
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgb(52,211,153)" strokeWidth="4" strokeDasharray="24 100" strokeDashoffset="-62" strokeLinecap="round" transform="rotate(-90 18 18)" />
    </svg>
  );
}

// ─── Variantes por feature ──────────────────────────────────────────────────

function MetricsMock() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Vistas" value="48.2K" delta="+12.4%" up Icon={Eye} />
        <KpiCard label="Seguidores" value="6.727" delta="+3.1%" up Icon={Users} />
        <KpiCard label="Engagement" value="5.8%" delta="+0.6%" up Icon={Heart} />
        <KpiCard label="Alcance" value="112K" delta="−2.0%" up={false} Icon={TrendingUp} />
      </div>
      <div className="glass-card p-5"><AreaChart /></div>
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card col-span-2 space-y-4 p-5">
          <div className={`h-4 w-40 ${skel}`} />
          {["78%", "64%", "52%", "41%"].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-11 w-11 shrink-0 rounded-lg bg-foreground/[0.08]" />
              <div className="min-w-0 flex-1">
                <div className={`h-3 ${skel}`} style={{ width: w }} />
                <div className={`mt-2 h-2.5 w-1/4 ${skelSoft}`} />
              </div>
            </div>
          ))}
        </div>
        <div className="glass-card p-5">
          <div className={`mb-4 h-4 w-24 ${skel}`} />
          <div className="flex h-32 items-end justify-between gap-2">
            {[62, 80, 45, 90, 70, 55, 84].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-violet-500/25 to-violet-400/70" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompetitorsMock() {
  return (
    <div className="space-y-5">
      {/* fila de competidores */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card flex items-center gap-3 p-4">
            <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-violet-500/40 to-fuchsia-400/20" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className={`h-3 w-3/4 ${skel}`} />
              <div className={`h-2.5 w-1/2 ${skelSoft}`} />
            </div>
          </div>
        ))}
      </div>
      {/* grilla de reels de la competencia */}
      <div className="grid grid-cols-6 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="relative aspect-[9/16] overflow-hidden rounded-xl bg-gradient-to-b from-foreground/[0.07] to-foreground/[0.03]">
            <div className="absolute inset-0 flex items-center justify-center">
              <Play size={16} className="text-foreground/30" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-7 bg-gradient-to-t from-black/25 to-transparent" />
            <div className="absolute bottom-2 left-2 h-2 w-8 rounded bg-white/50" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AudienceMock() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Seguidores" value="6.727" delta="+3.1%" up Icon={Users} />
        <KpiCard label="Alcance" value="112K" delta="+8.4%" up Icon={TrendingUp} />
        <KpiCard label="Perfil" value="9.1K" delta="+5.2%" up Icon={Eye} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card flex items-center gap-6 p-6">
          <Donut />
          <div className="flex-1 space-y-3">
            {["62%", "24%", "14%"].map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${["bg-violet-500", "bg-emerald-400", "bg-amber-400"][i]}`} />
                <div className={`h-2.5 ${skelSoft}`} style={{ width: w }} />
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card space-y-3.5 p-6">
          <div className={`h-4 w-28 ${skel}`} />
          {["86%", "70%", "55%", "38%", "22%"].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`h-2.5 w-12 ${skelSoft}`} />
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                <div className="h-full rounded-full bg-violet-400/60" style={{ width: w }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SalesMock() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="stat-label">Facturación</span>
            <DollarSign size={15} className="text-emerald-400" />
          </div>
          <div className="text-[26px] font-light leading-none text-emerald-300">$12.4K</div>
        </div>
        <div className="glass-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="stat-label">Cobrado</span>
            <DollarSign size={15} className="text-emerald-400" />
          </div>
          <div className="text-[26px] font-light leading-none text-emerald-300">$8.9K</div>
        </div>
        <div className="glass-card flex items-center justify-center p-4">
          <Donut />
        </div>
      </div>
      <div className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className={`h-4 w-36 ${skel}`} />
          <div className="h-7 w-24 rounded-lg bg-foreground/[0.06]" />
        </div>
        <div className="space-y-3.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-foreground/[0.08]" />
              <div className={`h-3 w-1/3 ${skel}`} />
              <div className={`h-3 w-20 ${skelSoft}`} />
              <div className="flex-1" />
              <div className="h-3.5 w-16 rounded bg-emerald-400/40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BoardMock() {
  const chips = new Set([2, 4, 9, 11, 15, 18, 20, 24, 27, 30]);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-7 gap-2">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <div key={i} className={`h-3 w-6 ${skelSoft} mx-auto`} />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="glass-card flex aspect-[4/3] flex-col gap-1 p-2">
            <div className={`h-2 w-4 ${skelSoft}`} />
            {chips.has(i) && (
              <div className={`mt-auto h-4 rounded ${["bg-violet-400/40", "bg-emerald-400/40", "bg-amber-400/40", "bg-rose-400/40"][i % 4]}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatMock() {
  const bubbles: Array<{ me: boolean; w: string }> = [
    { me: false, w: "62%" }, { me: true, w: "44%" }, { me: false, w: "78%" },
    { me: true, w: "36%" }, { me: false, w: "70%" },
  ];
  return (
    <div className="grid grid-cols-4 gap-5">
      {/* sesiones */}
      <div className="glass-card space-y-3 p-4">
        <div className={`mb-2 h-4 w-24 ${skel}`} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5 rounded-lg bg-foreground/[0.04] p-2.5">
            <div className={`h-2.5 w-3/4 ${skel}`} />
            <div className={`h-2 w-1/2 ${skelSoft}`} />
          </div>
        ))}
      </div>
      {/* conversación */}
      <div className="col-span-3 flex flex-col">
        <div className="flex-1 space-y-4">
          {bubbles.map((b, i) => (
            <div key={i} className={`flex items-end gap-2.5 ${b.me ? "justify-end" : "justify-start"}`}>
              {!b.me && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15"><Bot size={15} className="text-violet-400" /></div>}
              <div className={`rounded-2xl px-4 py-3 ${b.me ? "bg-violet-500/15" : "bg-foreground/[0.05]"}`} style={{ width: b.w }}>
                <div className={`h-2.5 ${skelSoft}`} />
                <div className={`mt-2 h-2.5 w-2/3 ${skelSoft}`} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 h-12 rounded-xl border border-border bg-foreground/[0.04]" />
      </div>
    </div>
  );
}

const MOCKS: Record<PreviewKind, () => React.ReactElement> = {
  metrics: MetricsMock,
  competitors: CompetitorsMock,
  audience: AudienceMock,
  sales: SalesMock,
  board: BoardMock,
  chat: ChatMock,
};

export function LockedPreview({ kind = "metrics" }: { kind?: PreviewKind }) {
  const Mock = MOCKS[kind] ?? MetricsMock;
  return (
    <div className="px-8 py-10">
      <PageHeader />
      <Mock />
    </div>
  );
}
