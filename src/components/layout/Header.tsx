import { TrendingUp, Eye, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { cache } from "react";
import { HeaderClient } from "./HeaderClient";

function fmtHeader(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

const getUserProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, email")
    .eq("id", user.id)
    .single();

  return { user, profile };
});

export async function Header() {
  const { user, profile } = await getUserProfile();

  // ── Fetch real IG stats ──
  let headerViews = "—";
  let headerFollowers = "—";
  let headerEngRate = "—";
  try {
    const supabase = await createClient();
    const workspaceId = await getWorkspaceId();
    if (workspaceId) {
      const [{ data: insights }, { data: reelMetrics }] = await Promise.all([
        supabase
          .from("ig_account_insights")
          .select("followers_total, total_interactions, impressions")
          .eq("workspace_id", workspaceId)
          .order("metric_date", { ascending: false })
          .limit(90),
        supabase
          .from("reels")
          .select("reel_metrics (views_org), reel_metrics_paid (views_paid)")
          .eq("workspace_id", workspaceId)
          .limit(500),
      ]);
      if (insights && insights.length > 0) {
        const latest = insights[0];
        if (latest.followers_total > 0) headerFollowers = fmtHeader(latest.followers_total);
        const totalInteractions = insights.reduce((s, d) => s + (d.total_interactions ?? 0), 0);
        const totalImpressions = insights.reduce((s, d) => s + (d.impressions ?? 0), 0);
        if (totalImpressions > 0) {
          headerEngRate = `${((totalInteractions / totalImpressions) * 100).toFixed(1)}%`;
        }
      }
      if (reelMetrics && reelMetrics.length > 0) {
        const totalViews = reelMetrics.reduce((s, r) => {
          const m = r.reel_metrics as unknown as { views_org: number } | null;
          const p = r.reel_metrics_paid as unknown as { views_paid: number } | null;
          return s + (m?.views_org ?? 0) + (p?.views_paid ?? 0);
        }, 0);
        if (totalViews > 0) headerViews = fmtHeader(totalViews);
      }
    }
  } catch { /* header stats are non-critical */ }

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const isAdmin = profile?.role === "admin";

  return (
    <header className="h-[80px] w-full flex items-center justify-center px-6 z-50 sticky top-0 backdrop-blur-xl bg-background/85 dark:bg-black/55">
      {/* ── Pill Container ── */}
      <div
        className="flex items-center justify-between w-full max-w-full h-[52px] px-4 rounded-2xl"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderTop: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Left — User Profile. Logo Moka plano (sin fondo violeta). Al hover
            del group, el logo hace un head-tilt tipo perrito (ver globals.css). */}
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="h-10 w-10 flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/moka.svg"
              alt="Moka"
              width={36}
              height={36}
              className="moka-head-tilt"
              style={{ width: 36, height: 36, objectFit: "contain" }}
            />
          </div>
          <div className="hidden md:flex flex-col justify-center">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-medium text-foreground tracking-tight leading-none group-hover:text-foreground/80 transition-colors">
                {displayName}
              </span>
              <span
                className={`text-[8px] font-semibold px-1.5 py-[2px] rounded-full leading-none border ${
                  isAdmin
                    ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/20 dark:text-indigo-300"
                    : "bg-accent text-muted-foreground border-border"
                }`}
              >
                {isAdmin ? "ADMIN" : "PRO"}
              </span>
            </div>
          </div>
          {/* Removed ChevronDown — no dropdown functionality */}
        </div>

        {/* Center — Quick Stats Ticker */}
        <div className="hidden lg:flex items-center gap-5">
          {[
            { icon: Eye, label: "Views", value: headerViews, color: "text-blue-400" },
            { icon: Users, label: "Followers", value: headerFollowers, color: "text-violet-400" },
            { icon: TrendingUp, label: "Eng. Rate", value: headerEngRate, color: "text-emerald-400" },
          ].map((stat, i) => (
            <div key={stat.label} className="flex items-center">
              {i > 0 && <div className="w-[1px] h-5 mr-5 bg-border" />}
              <div className="flex items-center gap-2.5">
                <stat.icon className={`h-4 w-4 ${stat.color} opacity-60`} strokeWidth={1.8} />
                <div className="flex flex-col">
                  <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-[0.1em] leading-none">{stat.label}</span>
                  <span className="text-[15px] font-light text-foreground leading-none mt-1 tracking-[-0.01em]">{stat.value}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right — Search, Date, Bell */}
        <div className="flex items-center gap-2">
          {/* Search bar removed */}

          <HeaderClient />

          {/* Bell — disabled until notifications system is built */}
        </div>
      </div>
    </header>
  );
}
