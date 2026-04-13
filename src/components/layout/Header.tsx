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
    <header className="h-[80px] w-full flex items-center justify-center px-6 z-30 sticky top-0 backdrop-blur-xl" style={{ background: "rgba(0,0,0,0.3)" }}>
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
        {/* Left — User Profile */}
        <div className="flex items-center gap-3 cursor-pointer group">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              boxShadow: "0 0 12px rgba(99,102,241,0.3)",
            }}
          >
            <svg width="16" height="14" viewBox="0 0 607.13 523.93" xmlns="http://www.w3.org/2000/svg" aria-label="Arko">
              <path fill="#fff" d="M412.55,17.53c-4.06-10.56-14.2-17.53-25.51-17.53h-185.69l-.23.57,79.73,207.46s0,.05.02.09c.66,3.31,4.16,22.81-8.98,40.42-12.23,16.41-30.03,19.33-33.45,19.83h-121.46c-11.31,0-21.46,6.97-25.51,17.53L0,523.93h204.93l77.56-201.82c3.56-7.38,11.97-22.46,28.68-35.1,1.71-1.33,3.54-2.61,5.44-3.84,16-10.42,31.4-13.64,40.08-14.78h152.26L412.55,17.53Z"/>
              <path fill="#fff" d="M607.13,523.93h-204.93l-23.47-61.08c-18.53-49.04,6.47-104.64,55.35-123.28,48.72-18.58,104.22,5.99,123.21,54.68l49.84,129.68Z"/>
            </svg>
          </div>
          <div className="hidden md:flex flex-col justify-center">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-medium text-white tracking-tight leading-none group-hover:text-white/80 transition-colors">
                {displayName}
              </span>
              <span
                className="text-[8px] font-semibold px-1.5 py-[2px] rounded-full leading-none"
                style={{
                  background: isAdmin ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                  color: isAdmin ? "#a5b4fc" : "rgba(255,255,255,0.35)",
                  border: isAdmin ? "1px solid rgba(99,102,241,0.2)" : "1px solid rgba(255,255,255,0.06)",
                }}
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
              {i > 0 && <div className="w-[1px] h-5 mr-5" style={{ background: "rgba(255,255,255,0.06)" }} />}
              <div className="flex items-center gap-2.5">
                <stat.icon className={`h-4 w-4 ${stat.color} opacity-60`} strokeWidth={1.8} />
                <div className="flex flex-col">
                  <span className="text-[9px] text-white/20 font-medium uppercase tracking-[0.1em] leading-none">{stat.label}</span>
                  <span className="text-[15px] font-light text-white leading-none mt-1 tracking-[-0.01em]">{stat.value}</span>
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
