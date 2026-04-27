"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useTransition, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Settings,
  LogOut,
  Shield,
} from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { useTheme } from "./ThemeProvider";

const BROWN = "#111111";
const BROWN_LIGHT = "rgba(0,0,0,0.65)";

// Brand/proper-noun labels (Dashboard/Instagram/YouTube/Meta Ads/Moka AI) stay
// untranslated; only "Ventas" varies between locales.
const buildNavItems = (t: (key: string) => string) => [
  { name: "Dashboard",   href: "/",          svg: "/svgs/dashboard_21.svg" },
  { name: "Instagram",   href: "/instagram", svg: "/svgs/instagram_5.svg" },
  { name: "YouTube",     href: "/youtube",   svg: "/svgs/youtube_16.svg" },
  { name: "Meta Ads",    href: "/ads",       svg: "/svgs/meta_logo.svg" },
  { name: t("ventas"),   href: "/ventas",    svg: "/svgs/megaphone_9.svg" },
  { name: "Moka AI",     href: "/agents",    svg: "/svgs/robot_6.svg" },
];

const buildSettingsNavItems = (t: (key: string) => string) => [
  { name: t("branding"),     href: "/settings",              svg: "/svgs/dashboard_21.svg" },
  { name: t("adn"),          href: "/settings/adn",          svg: "/logos/moka.svg" },
  { name: t("metas"),        href: "/settings/metas",        svg: "/svgs/megaphone_9.svg" },
  { name: t("integrations"), href: "/settings/integrations", svg: "/svgs/instagram_5.svg" },
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
  const t = useTranslations("nav");
  const navItems = buildNavItems(t);
  const settingsNavItems = buildSettingsNavItems(t);
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
          background: `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, ${BROWN} 50%, rgba(0,0,0,0.1) 100%)`,
          boxShadow: "0 0 8px rgba(0,0,0,0.35)",
        }
      : {
          background: "linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.1) 100%)",
          boxShadow: "0 0 8px rgba(255,255,255,0.3)",
        };
  }

  function iconFilter(isActive: boolean) {
    if (isLight) {
      // brightness(0)→black, full black icons in light mode
      return { filter: "brightness(0)", opacity: isActive ? 1 : 0.55 };
    }
    return { filter: "brightness(0) invert(1)", opacity: isActive ? 1 : 0.4 };
  }

  function navTextClass(isActive: boolean) {
    if (isLight) {
      return isActive
        ? "font-bold text-[#111111] tracking-wide"
        : "font-normal text-[#111111] tracking-wide";
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
          ? { background: "#fbfbfd" }
          : { background: "rgba(0,0,0,0.4)", borderRight: "1px solid rgba(255,255,255,0.06)" }
      }
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5 shrink-0">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={brandName ?? "Logo"}
            className="w-9 h-9 rounded-lg object-cover shrink-0"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/logos/moka.svg"
            alt="Moka"
            width={36}
            height={36}
            className="w-9 h-9 object-contain shrink-0"
          />
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
            {brandName ? t("subtitlePoweredBy") : t("subtitleDefault")}
          </p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {isInSettings && (
          <div className={`px-3 pb-3 mb-1 border-b ${isLight ? "border-gray-100" : "border-white/[0.06]"}`}>
            <p className={`text-[10px] uppercase tracking-[0.12em] font-medium ${isLight ? "text-gray-400" : "text-white/30"}`}>
              {t("settingsHeader")}
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

              {/* Logos de marca → grayscale + opacity. Conservan todo el
                  detalle interno del logo (no silueta plana); el grayscale
                  elimina colores y la opacity los suaviza para matchear el
                  tono gris claro del sidebar. */}
              <Image
                src={item.svg}
                alt={item.name}
                width={item.svg.includes("/logos/") ? 26 : 20}
                height={item.svg.includes("/logos/") ? 26 : 20}
                className="relative z-10 shrink-0 transition-opacity"
                style={item.svg.includes("/logos/")
                  ? { filter: "grayscale(1)", opacity: isActive ? 0.75 : 0.55 }
                  : iconFilter(isActive)}
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
          {/* Logo Moka en grayscale + opacity — conserva el detalle del
              perrito (ojos, manchas) pero en gris claro. */}
          <Image
            src="/logos/moka.svg"
            alt={t("adn")}
            width={26}
            height={26}
            className="relative z-10 shrink-0 transition-opacity"
            style={{
              filter: "grayscale(1)",
              opacity: isItemActive("/settings/adn") ? 0.75 : 0.55,
            }}
          />
          <span
            className={`text-[14px] transition-colors relative z-10 flex-1 ${navTextClass(isItemActive("/settings/adn"))}`}
            style={isLight ? { color: isItemActive("/settings/adn") ? BROWN : "rgba(17,17,17,0.56)" } : undefined}
          >
            {t("adn")}
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
              {t("backToApp")}
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
            <span className="text-[14px] tracking-wide font-normal text-amber-400/60 transition-colors group-hover:text-amber-400">{t("admin")}</span>
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
            {t("settings")}
          </span>
        </Link>

        <form action={logout}>
          <button
            type="submit"
            className="w-full relative flex items-center gap-3 px-3 h-[32px] rounded-lg transition-all duration-200 hover:bg-red-500/[0.05] text-red-400/60 hover:text-red-400"
          >
            <LogOut size={16} strokeWidth={1.5} />
            <span className="text-[14px] tracking-wide font-normal">{t("logout")}</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
