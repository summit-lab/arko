import { Bell, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { full_name: string | null; role: string; email: string } | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, role, email")
      .eq("id", user.id)
      .single();
    profile = data;
  }

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
    <header
      className="h-[80px] w-full flex items-center justify-between px-8 z-30 sticky top-0 bg-[#0e0d14]"
    >
      {/* Left — User Profile (Stakent Style) */}
      <div className="flex items-center gap-3.5 cursor-pointer group">
        {/* Avatar */}
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          }}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="hidden md:flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[12px] font-medium text-white/40 group-hover:text-white/60 transition-colors">
              @{username}
            </span>
            <span
              className="text-[9px] font-semibold px-1.5 py-[1px] rounded leading-none flex items-center"
              style={{
                background: isAdmin
                  ? "rgba(99,102,241,0.15)"
                  : "rgba(255,255,255,0.04)",
                color: isAdmin ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                border: isAdmin
                  ? "1px solid rgba(99,102,241,0.2)"
                  : "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {isAdmin ? "ADMIN" : "PRO"}
            </span>
          </div>
          <span className="text-[15px] font-medium text-white tracking-tight leading-none mt-1 group-hover:text-white/80 transition-colors">
            {displayName}
          </span>
        </div>

        <ChevronDown className="w-4 h-4 text-white/20 ml-1 group-hover:text-white/50 transition-colors" />
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-3">
        {/* Bell */}
        <button
          className="h-9 w-9 flex items-center justify-center rounded-xl relative transition-colors hover:bg-white/[0.08]"
          style={{
            background: "rgba(255,255,255,0.03)",
            color: "rgba(255,255,255,0.45)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <Bell className="h-4 w-4" />
          <span
            className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full"
            style={{ background: "#ef4444", boxShadow: "0 0 6px #ef4444" }}
          />
        </button>
      </div>
    </header>
  );
}
