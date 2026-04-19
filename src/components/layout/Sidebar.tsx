"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useTransition, useCallback } from "react";
import {
  Settings,
  LogOut,
  Shield,
} from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { useTheme } from "./ThemeProvider";

const BROWN = "#7c3b0f";
const BROWN_LIGHT = "rgba(124,59,15,0.65)";

const navItems = [
  { name: "Dashboard",  href: "/",          svg: "/svgs/dashboard_21.svg" },
  { name: "Instagram",  href: "/instagram", svg: "/svgs/instagram_5.svg" },
  { name: "YouTube",    href: "/youtube",   svg: "/svgs/youtube_16.svg" },
  { name: "Meta Ads",   href: "/ads",       svg: "/svgs/meta_logo.svg" },
  { name: "Ventas",     href: "/ventas",    svg: "/svgs/megaphone_9.svg" },
  { name: "Moka AI",   href: "/agents",    svg: "/svgs/robot_6.svg" },
];

const settingsNavItems = [
  { name: "Branding",     href: "/settings",       svg: "/svgs/dashboard_21.svg" },
  { name: "ADN de Marca", href: "/settings/adn", svg: "/svgs/arko-adn_1.svg" },
  { name: "Metas",        href: "/settings/metas", svg: "/svgs/megaphone_9.svg" },
];

interface SidebarProps {
  isAdmin?: boolean;
  adnPending?: boolean;
  brandName?: string | null;
  logoUrl?: string | null;
}

export function Sidebar({ isAdmin = false, adnPending = false, brandName, logoUrl }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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

  const activeHref = optimisticHref ?? pathname;
  const isInSettings = activeHref.startsWith("/settings");
  const currentNavItems = isInSettings ? settingsNavItems : navItems;

  function isItemActive(href: string) {
    if (href === "/settings") return activeHref === "/settings";
    return href === "/" ? activeHref === "/" : activeHref.startsWith(href);
  }

  function activeBarStyle() {
    return isLight
      ? {
          background: `linear-gradient(to bottom, rgba(124,59,15,0.1) 0%, ${BROWN} 50%, rgba(124,59,15,0.1) 100%)`,
          boxShadow: "0 0 8px rgba(124,59,15,0.35)",
        }
      : {
          background: "linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.1) 100%)",
          boxShadow: "0 0 8px rgba(255,255,255,0.3)",
        };
  }

  function iconFilter(isActive: boolean) {
    if (isLight) {
      return { filter: "brightness(0)", opacity: isActive ? 0.85 : 0.45 };
    }
    return { filter: "brightness(0) invert(1)", opacity: isActive ? 1 : 0.4 };
  }

  function navTextClass(isActive: boolean) {
    if (isLight) {
      return isActive
        ? "font-medium tracking-wide"
        : "font-light tracking-wide";
    }
    return isActive
      ? "font-medium text-white tracking-wide"
      : "font-light text-white/40 group-hover:text-white/65 tracking-wide";
  }

  return (
    <aside
      className="w-[260px] h-screen fixed left-0 top-0 z-40 flex flex-col backdrop-blur-xl"
      style={
        isLight
          ? { background: "#ffffff", borderRight: "1px solid #e5e5e7" }
          : { background: "rgba(0,0,0,0.4)", borderRight: "1px solid rgba(255,255,255,0.06)" }
      }
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5 shrink-0">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={brandName ?? "Logo"}
            className="w-9 h-9 rounded-lg object-cover shrink-0"
          />
        ) : (
          <svg width="36" height="36" viewBox="0 0 607.13 523.93" xmlns="http://www.w3.org/2000/svg" aria-label="Moka">
            <defs>
              <linearGradient id="logo-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isLight ? BROWN : "#ffffff"} />
                <stop offset="100%" stopColor={isLight ? "#5a2a0a" : "#9a9a9a"} />
              </linearGradient>
            </defs>
            <path fill="url(#logo-grad)" d="M412.55,17.53c-4.06-10.56-14.2-17.53-25.51-17.53h-185.69l-.23.57,79.73,207.46s0,.05.02.09c.66,3.31,4.16,22.81-8.98,40.42-12.23,16.41-30.03,19.33-33.45,19.83h-121.46c-11.31,0-21.46,6.97-25.51,17.53L0,523.93h204.93l77.56-201.82c3.56-7.38,11.97-22.46,28.68-35.1,1.71-1.33,3.54-2.61,5.44-3.84,16-10.42,31.4-13.64,40.08-14.78h152.26L412.55,17.53Z"/>
            <path fill="url(#logo-grad)" d="M607.13,523.93h-204.93l-23.47-61.08c-18.53-49.04,6.47-104.64,55.35-123.28,48.72-18.58,104.22,5.99,123.21,54.68l49.84,129.68Z"/>
          </svg>
        )}
        <div className="leading-none min-w-0">
          <p
            className="font-bold tracking-tight leading-none truncate"
            style={
              isLight
                ? {
                    fontSize: brandName && brandName.length > 14 ? "20px" : "30px",
                    color: BROWN,
                    WebkitTextFillColor: BROWN,
                  }
                : {
                    fontSize: brandName && brandName.length > 14 ? "20px" : "30px",
                    background: "linear-gradient(to bottom, #ffffff 0%, #9a9a9a 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }
            }
          >
            {brandName ?? "Moka"}
          </p>
          <p
            className="text-[12px] mt-1 font-medium tracking-wide"
            style={{ color: isLight ? BROWN_LIGHT : "rgba(255,255,255,0.35)" }}
          >
            {brandName ? "powered by Moka" : "Intelligence Suite"}
          </p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {isInSettings && (
          <div className={`px-3 pb-3 mb-1 border-b ${isLight ? "border-gray-100" : "border-white/[0.06]"}`}>
            <p className={`text-[10px] uppercase tracking-[0.12em] font-medium ${isLight ? "text-gray-400" : "text-white/30"}`}>
              Configuración
            </p>
          </div>
        )}
        {currentNavItems.map((item) => {
          const isActive = isItemActive(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={(e) => handleNav(item.href, e)}
              className={`group relative flex items-center gap-3.5 px-3 h-[42px] rounded-lg transition-all duration-200 overflow-hidden ${
                isActive
                  ? "bg-white/[0.06]"
                  : "hover:bg-white/[0.03]"
              }`}
            >
              {isActive && (
                <div
                  className="absolute left-0 top-[15%] bottom-[15%] w-[2px] rounded-full pointer-events-none"
                  style={activeBarStyle()}
                />
              )}

              <Image
                src={item.svg}
                alt={item.name}
                width={20}
                height={20}
                className="relative z-10 shrink-0 transition-opacity"
                style={iconFilter(isActive)}
              />
              <span
                className={`text-[14px] transition-colors relative z-10 ${navTextClass(isActive)}`}
                style={isLight ? { color: isActive ? BROWN : "rgba(17,17,17,0.56)" } : undefined}
              >
                {item.name}
              </span>

              {isActive && (
                <div
                  className="absolute right-0 top-0 bottom-0 w-[16px] pointer-events-none"
                  style={{
                    background: isLight
                      ? "linear-gradient(to right, transparent, rgba(124,59,15,0.03))"
                      : "linear-gradient(to right, transparent, rgba(255,255,255,0.015))",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── ADN de Marca ── */}
      {!isInSettings && <div className="px-3 pb-2">
        <Link
          href="/settings/adn"
          onClick={(e) => handleNav("/settings/adn", e)}
          className={`group relative flex items-center gap-3.5 px-3 h-[42px] rounded-lg transition-all duration-200 overflow-hidden ${
            isItemActive("/settings/adn")
              ? "bg-white/[0.06]"
              : "hover:bg-white/[0.03]"
          }`}
        >
          {isItemActive("/settings/adn") && (
            <div
              className="absolute left-0 top-[15%] bottom-[15%] w-[2px] rounded-full pointer-events-none"
              style={activeBarStyle()}
            />
          )}
          <Image
            src="/svgs/arko-adn_1.svg"
            alt="ADN de Marca"
            width={20}
            height={20}
            className="relative z-10 shrink-0 transition-opacity"
            style={iconFilter(isItemActive("/settings/adn"))}
          />
          <span
            className={`text-[14px] transition-colors relative z-10 flex-1 ${navTextClass(isItemActive("/settings/adn"))}`}
            style={isLight ? { color: isItemActive("/settings/adn") ? BROWN : "rgba(17,17,17,0.56)" } : undefined}
          >
            ADN de Marca
          </span>
          {adnPending && (
            <span className="relative z-10 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
          )}
          {isItemActive("/settings/adn") && (
            <div
              className="absolute right-0 top-0 bottom-0 w-[16px] pointer-events-none"
              style={{
                background: isLight
                  ? "linear-gradient(to right, transparent, rgba(124,59,15,0.03))"
                  : "linear-gradient(to right, transparent, rgba(255,255,255,0.015))",
              }}
            />
          )}
        </Link>
      </div>}

      {/* ── Settings back link ── */}
      {isInSettings && (
        <div className="px-3 pb-2">
          <Link
            href="/"
            onClick={(e) => handleNav("/", e)}
            className="group flex items-center gap-3 px-3 h-[42px] rounded-lg transition-all duration-200 hover:bg-white/[0.03]"
          >
            <span className={`transition-colors text-sm ${isLight ? "text-gray-400 group-hover:text-gray-600" : "text-white/30 group-hover:text-white/60"}`}>←</span>
            <span className={`text-[13px] font-light tracking-wide transition-colors ${isLight ? "text-gray-400 group-hover:text-gray-600" : "text-white/30 group-hover:text-white/60"}`}>
              Volver al app
            </span>
          </Link>
        </div>
      )}

      {/* ── Bottom ── */}
      <div className={`px-3 py-6 space-y-1 border-t ${isLight ? "border-gray-100" : "border-white/[0.06]"}`}>
        {isAdmin && (
          <Link
            href="/admin"
            onClick={(e) => handleNav("/admin", e)}
            className="group relative flex items-center gap-3 px-3 h-[32px] rounded-lg transition-all duration-200 hover:bg-amber-500/[0.05]"
          >
            <Shield size={16} strokeWidth={1.5} className="text-amber-400/60 transition-colors group-hover:text-amber-400" />
            <span className="text-[14px] tracking-wide font-normal text-amber-400/60 transition-colors group-hover:text-amber-400">Admin</span>
          </Link>
        )}
        <Link
          href="/settings"
          onClick={(e) => handleNav("/settings", e)}
          className="group relative flex items-center gap-3 px-3 h-[32px] rounded-lg transition-all duration-200 hover:bg-white/[0.03]"
        >
          <Settings
            size={16}
            strokeWidth={1.5}
            style={{ color: isLight ? "rgba(17,17,17,0.45)" : "rgba(255,255,255,0.4)" }}
            className="transition-colors group-hover:opacity-80"
          />
          <span
            className="text-[14px] tracking-wide font-normal transition-colors"
            style={{ color: isLight ? "rgba(17,17,17,0.50)" : "rgba(255,255,255,0.4)" }}
          >
            Settings
          </span>
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
