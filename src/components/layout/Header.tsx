import { Bell, ChevronDown, Search, TrendingUp, Eye, Users } from "lucide-react";
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
      const { data: insights } = await supabase
        .from("ig_account_insights")
        .select("followers_total, total_interactions, impressions")
        .eq("workspace_id", workspaceId)
        .order("metric_date", { ascending: false })
        .limit(90);
      if (insights && insights.length > 0) {
        const latest = insights[0];
        if (latest.followers_total > 0) headerFollowers = fmtHeader(latest.followers_total);
        const totalInteractions = insights.reduce((s, d) => s + (d.total_interactions ?? 0), 0);
        const totalImpressions = insights.reduce((s, d) => s + (d.impressions ?? 0), 0);
        if (totalImpressions > 0) {
          headerViews = fmtHeader(totalImpressions);
          headerEngRate = `${((totalInteractions / totalImpressions) * 100).toFixed(1)}%`;
        }
      }
    }
  } catch { /* header stats are non-critical */ }

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const username = profile?.email?.split("@")[0] || "user";
  const isAdmin = profile?.role === "admin";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
            className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              boxShadow: "0 0 12px rgba(99,102,241,0.3)",
            }}
          >
            {initials}
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
          <ChevronDown className="w-3.5 h-3.5 text-white/15 group-hover:text-white/40 transition-colors" />
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
          {/* Search */}
          <div
            className="hidden md:flex items-center gap-2 h-8 px-3 rounded-xl cursor-pointer transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.1]"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <Search className="h-3.5 w-3.5 text-white/20" strokeWidth={1.8} />
            <span className="text-[11px] text-white/20 font-light">Search...</span>
            <span className="text-[9px] text-white/12 font-medium ml-3 px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)" }}>⌘K</span>
          </div>

          <HeaderClient />

          {/* Bell */}
          <button
            className="h-8 w-8 flex items-center justify-center rounded-xl relative transition-all duration-200 hover:bg-white/[0.08]"
            style={{
              background: "rgba(255,255,255,0.03)",
              color: "rgba(255,255,255,0.4)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <Bell className="h-3.5 w-3.5" strokeWidth={1.8} />
            <span
              className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full"
              style={{ background: "#ef4444", boxShadow: "0 0 6px #ef4444" }}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
