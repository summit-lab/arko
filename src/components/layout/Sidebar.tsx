"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useTransition, useCallback } from "react";
import {
  LayoutGrid,
  Instagram,
  Youtube,
  Megaphone,
  Users,
  Bot,
  Settings,
  LogOut,
} from "lucide-react";
import { logout } from "@/app/(auth)/actions";

const navItems = [
  { name: "Dashboard",        href: "/",               icon: LayoutGrid },
  { name: "Instagram",        href: "/instagram",      icon: Instagram },
  { name: "YouTube",          href: "/youtube",        icon: Youtube },
  { name: "Ads Intelligence", href: "/ads",            icon: Megaphone },
  { name: "Customer Voice",   href: "/customer-voice", icon: Users },
  { name: "AI Agents",        href: "/agents",         icon: Bot },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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
                strokeWidth={isActive ? 2.5 : 1.5}
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
