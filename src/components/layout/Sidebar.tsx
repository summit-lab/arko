"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useTransition, useCallback } from "react";
import { Settings, LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { createClient } from "@/lib/supabase/client";

type IconProps = { size?: number; className?: string; style?: React.CSSProperties };

function DashboardIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor" className={className} style={style}>
      <path d="M28.44,284.44h170.67c15.69,0,28.44-12.72,28.44-28.44V28.44C227.56,12.72,214.81,0,199.11,0H28.44C12.72,0,0,12.72,0,28.44V256C0,271.72,12.72,284.44,28.44,284.44z M0,483.56C0,499.28,12.72,512,28.44,512h170.67c15.69,0,28.44-12.72,28.44-28.44V369.78c0-15.72-12.75-28.44-28.44-28.44H28.44C12.72,341.33,0,354.06,0,369.78V483.56z M284.44,483.56c0,15.72,12.69,28.44,28.44,28.44h170.67c15.72,0,28.44-12.72,28.44-28.44V284.44c0-15.72-12.72-28.44-28.44-28.44H312.89c-15.75,0-28.44,12.72-28.44,28.44V483.56z M312.89,199.11h170.67c15.72,0,28.44-12.72,28.44-28.44V28.44C512,12.72,499.28,0,483.56,0H312.89c-15.75,0-28.44,12.72-28.44,28.44v142.22C284.44,186.39,297.14,199.11,312.89,199.11z"/>
    </svg>
  );
}

function InstagramIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor" className={className} style={style}>
      <path d="M255.9,170.6c-47,0-85.4,38.4-85.4,85.4c0,47,38.4,85.4,85.4,85.4s85.4-38.4,85.4-85.4C341.3,209,302.9,170.6,255.9,170.6z M512,256c0-35.4,0.3-70.4-1.7-105.7C508.3,109.3,499,73,469,43C439,13,402.7,3.7,361.7,1.7C326.3-0.3,291.3,0,256,0c-35.4,0-70.4-0.3-105.7,1.7C109.3,3.7,73,13,43,43C13,73,3.7,109.3,1.7,150.3C-0.3,185.7,0,220.7,0,256s-0.3,70.4,1.7,105.7C3.7,402.7,13,439,43,469c30,30,66.3,39.3,107.3,41.3c35.4,2,70.4,1.7,105.7,1.7c35.4,0,70.4,0.3,105.7-1.7c41-2,77.4-11.3,107.3-41.3c30-30,39.3-66.3,41.3-107.3C512.4,326.4,512,291.4,512,256z M255.9,387.4c-72.7,0-131.4-58.7-131.4-131.4s58.7-131.4,131.4-131.4S387.3,183.3,387.3,256S328.6,387.4,255.9,387.4z M392.7,149.9c-17,0-30.7-13.7-30.7-30.7s13.7-30.7,30.7-30.7s30.7,13.7,30.7,30.7C423.4,136.2,409.7,149.9,392.7,149.9L392.7,149.9z"/>
    </svg>
  );
}

function YoutubeIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor" className={className} style={style}>
      <path d="M405.67,76.84H106.35C47.6,76.84,0,123.92,0,182.02v147.97c0,58.07,47.63,105.2,106.35,105.2h299.32c58.75,0,106.33-47.13,106.33-105.2V182.02c0-58.1-47.6-105.2-106.33-105.2V76.84z M333.77,263.19l-140,66.04c-2.81,1.35-6.16,0.18-7.52-2.61l-0.55-2.41V188c0-4.13,4.43-6.81,8.17-4.94l140.03,70.15c2.73,1.38,3.86,4.71,2.48,7.44l-2.61,2.56V263.19z"/>
    </svg>
  );
}

function MegaphoneIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor" className={className} style={style}>
      <path d="M101.7,109.7C45.5,109.7,0,155.2,0,211.4s45.5,101.7,101.7,101.7c9.2,0,16.8-6.8,18.2-15.6h0.3V128.2C120.2,118,111.9,109.7,101.7,109.7z"/>
      <path d="M512,26.7c0-10.2-8.3-18.5-18.5-18.5c-4.2,0-8.1,1.5-11.2,3.9l-162.8,94H172.6c-10.2,0-18.5,8.3-18.5,18.5v175.7h0.2c1.1,9.1,8.8,16.2,18.3,16.2h130.3l178,102.8c3.3,3.1,7.7,5,12.6,5c10.2,0,18.5-8.3,18.5-18.5c0-0.7-0.1-1.4-0.2-2.1h0.2v-31.3V59.1V27.8h-0.1L512,26.7z"/>
      <path d="M298.3,457.3l-0.3-0.4l-0.2-0.5l-0.3-0.4L241,358l-0.2,0.1c-3.1-4.2-7.7-6.8-12.6-7.5v-0.2H179v0.1c-2.6,0.2-5.3,0.9-7.7,2.4c-8.9,5.1-11.9,16.4-6.8,25.3c0.4,0.8,1,1.4,1.5,2.1l-0.2,0.1l65.9,114.1l0,0l0,0l0.7,1.1l0.1-0.1c5.4,7.9,16,10.5,24.5,5.7c1-0.6,1.9-1.2,2.7-2l0.2,0.3l33.9-19.6l-0.2-0.3C300.1,474.4,302.1,465.1,298.3,457.3L298.3,457.3z"/>
    </svg>
  );
}

function CustomerVoiceIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor" className={className} style={style}>
      <path d="M335.7,323.19c29.31,0,53.07,23.76,53.07,53.07v21.67c0,13.53-4.23,26.72-12.1,37.73C340.19,486.71,280.62,512,199.91,512c-80.73,0-140.27-25.3-176.66-76.38c-7.83-10.99-12.04-24.16-12.04-37.66v-21.71c0-29.31,23.76-53.07,53.07-53.07H335.7z M437.17,2.34c8.49-4.85,19.3-1.9,24.15,6.59C487.05,53.96,500.79,105,500.79,158c0,53.18-13.83,104.39-39.73,149.53c-4.86,8.48-15.68,11.41-24.16,6.54c-8.48-4.86-11.41-15.68-6.54-24.16c22.85-39.82,35.04-84.96,35.04-131.91c0-46.8-12.11-91.79-34.81-131.52C425.73,18,428.68,7.19,437.17,2.34z M199.91,40.12c65.17,0,117.99,52.83,117.99,117.99S265.08,276.1,199.91,276.1c-65.16,0-117.99-52.83-117.99-117.99S134.75,40.12,199.91,40.12z M355.39,49.43c8.5-4.83,19.3-1.86,24.13,6.64C397.05,86.89,406.4,121.79,406.4,158c0,36.3-9.39,71.27-26.99,102.14c-4.84,8.49-15.65,11.45-24.14,6.61c-8.49-4.84-11.45-15.65-6.61-24.14C363.23,217.04,371,188.11,371,158c0-30.04-7.74-58.91-22.25-84.43C343.92,65.07,346.89,54.27,355.39,49.43z"/>
    </svg>
  );
}

function RobotIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor" className={className} style={style}>
      <path d="M256,51.2c14.16,0,25.6,11.44,25.6,25.6V128h96c31.84,0,57.6,25.76,57.6,57.6v217.6c0,31.84-25.76,57.6-57.6,57.6H134.4c-31.84,0-57.6-25.76-57.6-57.6V185.6c0-31.84,25.76-57.6,57.6-57.6h96V76.8C230.4,62.64,241.84,51.2,256,51.2z M166.4,358.4c-7.04,0-12.8,5.76-12.8,12.8c0,7.04,5.76,12.8,12.8,12.8H192c7.04,0,12.8-5.76,12.8-12.8c0-7.04-5.76-12.8-12.8-12.8H166.4z M243.2,358.4c-7.04,0-12.8,5.76-12.8,12.8c0,7.04,5.76,12.8,12.8,12.8h25.6c7.04,0,12.8-5.76,12.8-12.8c0-7.04-5.76-12.8-12.8-12.8H243.2z M320,358.4c-7.04,0-12.8,5.76-12.8,12.8c0,7.04,5.76,12.8,12.8,12.8h25.6c7.04,0,12.8-5.76,12.8-12.8c0-7.04-5.76-12.8-12.8-12.8H320z M211.2,256c0-17.67-14.33-32-32-32s-32,14.33-32,32c0,17.67,14.33,32,32,32S211.2,273.67,211.2,256z M332.8,288c17.67,0,32-14.33,32-32c0-17.67-14.33-32-32-32c-17.67,0-32,14.33-32,32C300.8,273.67,315.13,288,332.8,288z M38.4,230.4h12.8V384H38.4C17.2,384,0,366.8,0,345.6v-76.8C0,247.6,17.2,230.4,38.4,230.4z M473.6,230.4c21.2,0,38.4,17.2,38.4,38.4v76.8c0,21.2-17.2,38.4-38.4,38.4h-12.8V230.4H473.6z"/>
    </svg>
  );
}

const navItems = [
  { name: "Dashboard",        href: "/",               icon: DashboardIcon },
  { name: "Instagram",        href: "/instagram",      icon: InstagramIcon },
  { name: "YouTube",          href: "/youtube",        icon: YoutubeIcon },
  { name: "Ads Intelligence", href: "/ads",            icon: MegaphoneIcon },
  { name: "Customer Voice",   href: "/customer-voice", icon: CustomerVoiceIcon },
  { name: "AI Agents",        href: "/agents",         icon: RobotIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [igConnection, setIgConnection] = useState<{ username: string | null; status: string } | null>(null);

  // Fetch connected accounts
  useEffect(() => {
    async function fetchConnections() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: workspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .limit(1)
        .single();
      if (!workspace) return;

      const { data: connection } = await supabase
        .from("meta_connections")
        .select("ig_username, status")
        .eq("workspace_id", workspace.id)
        .single();

      if (connection) {
        setIgConnection({ username: connection.ig_username, status: connection.status }); // eslint-disable-line react-hooks/set-state-in-effect
      }
    }
    fetchConnections();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset optimistic state when pathname catches up
  useEffect(() => {
    setOptimisticHref(null); // eslint-disable-line react-hooks/set-state-in-effect
  }, [pathname]);

  const handleNav = useCallback((href: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (href === pathname) return;
    setOptimisticHref(href);
    window.dispatchEvent(new Event("nav:start"));
    startTransition(() => {
      router.push(href);
    });
  }, [router, pathname]);

  // Use optimistic href for active state so it changes INSTANTLY on click
  const activeHref = optimisticHref ?? pathname;

  function isItemActive(href: string) {
    return href === "/" ? activeHref === "/" : activeHref.startsWith(href);
  }

  return (
    <aside
      className="w-[260px] h-screen fixed left-0 top-0 z-40 flex flex-col"
      style={{ background: "rgba(0, 0, 0, 0.35)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5 shrink-0">
        <svg width="36" height="36" viewBox="0 0 607.13 523.93" xmlns="http://www.w3.org/2000/svg" aria-label="Arko">
          <defs>
            <linearGradient id="logo-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#9a9a9a" />
            </linearGradient>
          </defs>
          <path fill="url(#logo-grad)" d="M412.55,17.53c-4.06-10.56-14.2-17.53-25.51-17.53h-185.69l-.23.57,79.73,207.46s0,.05.02.09c.66,3.31,4.16,22.81-8.98,40.42-12.23,16.41-30.03,19.33-33.45,19.83h-121.46c-11.31,0-21.46,6.97-25.51,17.53L0,523.93h204.93l77.56-201.82c3.56-7.38,11.97-22.46,28.68-35.1,1.71-1.33,3.54-2.61,5.44-3.84,16-10.42,31.4-13.64,40.08-14.78h152.26L412.55,17.53Z"/>
          <path fill="url(#logo-grad)" d="M607.13,523.93h-204.93l-23.47-61.08c-18.53-49.04,6.47-104.64,55.35-123.28,48.72-18.58,104.22,5.99,123.21,54.68l49.84,129.68Z"/>
        </svg>
        <div className="leading-none">
          <p
            className="text-[30px] font-bold tracking-tight leading-none"
            style={{ background: "linear-gradient(to bottom, #ffffff 0%, #9a9a9a 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
            Arko
          </p>
          <p className="text-[12px] mt-1 text-white/35 font-medium tracking-wide">
            Intelligence Suite
          </p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = isItemActive(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={(e) => handleNav(item.href, e)}
              className={`group relative flex items-center gap-3.5 px-3 h-[42px] rounded-md transition-all duration-150 overflow-hidden ${
                isActive
                  ? "bg-white/[0.06]"
                  : "hover:bg-white/[0.03]"
              }`}
            >
              <item.icon
                size={20}
                className="transition-colors relative z-10 shrink-0"
                style={{ color: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.45)" }}
              />
              <span
                className={`text-[15px] tracking-wide transition-colors relative z-10 ${isActive ? "font-medium text-white" : "font-normal text-white/40 group-hover:text-white/70"}`}
              >
                {item.name}
              </span>

              {/* Efecto Glass / Reflejo en el borde derecho (Muy sutil) */}
              {isActive && (
                <>
                  {/* Glow interno muy suave */}
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-[16px] pointer-events-none"
                    style={{
                      background: "linear-gradient(to right, transparent, rgba(255,255,255,0.015))",
                    }}
                  />
                  {/* Línea de brillo cortada y sutil */}
                  <div
                    className="absolute right-0 top-[20%] bottom-[20%] w-[1px] pointer-events-none"
                    style={{
                      background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 100%)",
                      boxShadow: "-1px 0 2px 0 rgba(255, 255, 255, 0.15)",
                    }}
                  />
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Connected Accounts ── */}
      <div className="px-3 pb-3">
        <div
          className="rounded-lg p-3"
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-3">
            Cuentas conectadas
          </p>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <InstagramIcon
                size={14}
                style={{ color: igConnection?.status === "active" ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.25)" }}
              />
              {igConnection?.status === "active" && igConnection.username ? (
                <>
                  <span className="text-[13px] text-white/50">@{igConnection.username}</span>
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </>
              ) : (
                <span className="text-[13px] text-white/25">No conectado</span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <YoutubeIcon size={14} style={{ color: "rgba(255, 255, 255, 0.25)" }} />
              <span className="text-[13px] text-white/25">No conectado</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom ── */}
      <div className="px-3 py-6 space-y-1">
        <Link
          href="/settings"
          onClick={(e) => handleNav("/settings", e)}
          className="group relative flex items-center gap-3 px-3 h-[32px] rounded-lg transition-all duration-200 hover:bg-white/[0.03]"
        >
          <Settings size={16} strokeWidth={1.5} className="text-white/40 transition-colors group-hover:text-white/70" />
          <span className="text-[14px] tracking-wide font-normal text-white/40 transition-colors group-hover:text-white/70">Settings</span>
        </Link>

        <form action={logout}>
          <button
            type="submit"
            className="w-full relative flex items-center gap-3 px-3 h-[32px] rounded-lg transition-all duration-200 hover:bg-red-500/[0.05] text-red-400/60 hover:text-red-400"
          >
            <LogOut size={16} strokeWidth={1.5} />
            <span className="text-[14px] tracking-wide font-normal">Log out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
