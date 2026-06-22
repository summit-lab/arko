"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useTransition, useCallback, Fragment } from "react";
import { useTranslations } from "next-intl";
import {
  Settings,
  LogOut,
  Shield,
  LayoutDashboard,
  Clapperboard,
  BookImage,
  Swords,
  BookMarked,
  Users,
  Megaphone,
  Bot,
  Grid2X2,
  ChevronRight,
  Wrench,
  Pencil,
} from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { useTheme } from "./ThemeProvider";

const BROWN = "#111111";
const BROWN_LIGHT = "rgba(0,0,0,0.65)";

type LucideIconComponent = React.ComponentType<{
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}>;

interface NavItem {
  name: string;
  href: string;
  tab?: string;
  LucideIcon?: LucideIconComponent;
  svg?: string;
}

// Main nav: Dashboard + IG sub-items (flat) + Ventas + Moka AI
const buildNavItems = (t: (key: string) => string): NavItem[] => [
  { name: "Dashboard",       href: "/",          LucideIcon: LayoutDashboard },
  { name: "Reels",           href: "/instagram", tab: "reels",        LucideIcon: Clapperboard },
  { name: t("historias"),    href: "/instagram", tab: "historias",    LucideIcon: BookImage },
  { name: t("competencia"),  href: "/instagram", tab: "competencia",  LucideIcon: Swords },
  // { name: t("referencias"),  href: "/instagram", tab: "referencias",  LucideIcon: BookMarked },
  { name: t("tuAudiencia"),  href: "/instagram", tab: "metrics",      LucideIcon: Users },
  { name: t("ventas"),         href: "/ventas",            LucideIcon: Megaphone },
  { name: t("mesaDeTrabajo"), href: "/mesa-de-trabajo",  LucideIcon: Pencil },
  { name: "Moka AI",          href: "/agents",            LucideIcon: Bot },
];

// "Más herramientas" accordion items
const buildMasHerramientasItems = (t: (key: string) => string): NavItem[] => [
  { name: t("publicaciones"), href: "/instagram", tab: "publicaciones", LucideIcon: Grid2X2 },
  { name: "YouTube",          href: "/youtube",   svg: "/svgs/youtube_16.svg" },
  { name: "Meta Ads",         href: "/ads",       svg: "/svgs/meta_logo.svg" },
];

const buildSettingsNavItems = (t: (key: string) => string): NavItem[] => [
  { name: t("branding"),     href: "/settings",              svg: "/svgs/dashboard_21.svg" },
  { name: t("adn"),          href: "/settings/adn",          svg: "/logos/moka.svg" },
  { name: t("metas"),        href: "/settings/metas",        svg: "/svgs/megaphone_9.svg" },
  { name: t("integrations"), href: "/settings/integrations", svg: "/svgs/instagram_5.svg" },
];

// Paths that belong to "Más herramientas" — used for auto-expand
const MAS_HERRAMIENTAS_HREFS = ["/youtube", "/ads"];
const MAS_HERRAMIENTAS_IG_TABS = ["publicaciones"];


interface SidebarProps {
  isAdmin?: boolean;
  adnPending?: boolean;
  brandName?: string | null;
  logoUrl?: string | null;
}

export function Sidebar({ isAdmin = false, adnPending = false, brandName, logoUrl }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const t = useTranslations("nav");

  const navItems = buildNavItems(t);
  const settingsNavItems = buildSettingsNavItems(t);
  const masHerramientasItems = buildMasHerramientasItems(t);

  const [optimisticRoute, setOptimisticRoute] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const searchParamsStr = searchParams.toString();

  useEffect(() => {
    setOptimisticRoute(null);
  }, [pathname, searchParamsStr]);

  // Derive active path + tab (optimistic wins while transition is pending)
  const activeHref = optimisticRoute ? new URL(optimisticRoute, "http://x").pathname : pathname;
  const activeTab = optimisticRoute
    ? new URL(optimisticRoute, "http://x").searchParams.get("tab")
    : searchParams.get("tab");

  const isInSettings = activeHref.startsWith("/settings");

  // Auto-expand "Más herramientas" when the current route is one of its items
  const isInMasHerramientas =
    MAS_HERRAMIENTAS_HREFS.includes(activeHref) ||
    (activeHref === "/instagram" && MAS_HERRAMIENTAS_IG_TABS.includes(activeTab ?? ""));

  const [masHerramientasOpen, setMasHerramientasOpen] = useState(isInMasHerramientas);

  useEffect(() => {
    if (isInMasHerramientas) setMasHerramientasOpen(true);
  }, [isInMasHerramientas]);

  const currentNavItems = isInSettings ? settingsNavItems : navItems;

  const handleNav = useCallback(
    (href: string, e: React.MouseEvent, tab?: string) => {
      e.preventDefault();
      const fullHref = tab ? `${href}?tab=${tab}` : href;
      const currentFull = pathname + (searchParamsStr ? `?${searchParamsStr}` : "");
      if (fullHref === currentFull) return;
      setOptimisticRoute(fullHref);
      window.dispatchEvent(new Event("nav:start"));
      startTransition(() => {
        router.push(fullHref);
      });
    },
    [router, pathname, searchParamsStr]
  );

  function isItemActive(href: string, tab?: string): boolean {
    if (tab) return activeHref === href && activeTab === tab;
    if (href === "/settings") return activeHref === "/settings";
    if (href === "/") return activeHref === "/";
    return activeHref.startsWith(href);
  }

  function activeBarStyle() {
    return isLight
      ? {
          background: `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, ${BROWN} 50%, rgba(0,0,0,0.1) 100%)`,
          boxShadow: "0 0 8px rgba(0,0,0,0.35)",
        }
      : {
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.1) 100%)",
          boxShadow: "0 0 8px rgba(255,255,255,0.3)",
        };
  }

  function iconFilter(isActive: boolean) {
    if (isLight) {
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

  function lucideIconStyle(isActive: boolean): React.CSSProperties {
    if (isLight) {
      return { color: isActive ? BROWN : "rgba(17,17,17,0.42)", flexShrink: 0 };
    }
    return { color: "white", opacity: isActive ? 0.9 : 0.35, flexShrink: 0 };
  }

  function renderIcon(item: NavItem, isActive: boolean, size = 20) {
    if (item.LucideIcon) {
      const Icon = item.LucideIcon;
      return (
        <Icon
          size={size}
          strokeWidth={1.5}
          className="relative z-10 shrink-0 transition-opacity"
          style={lucideIconStyle(isActive)}
        />
      );
    }
    if (item.svg) {
      return (
        <Image
          src={item.svg}
          alt={item.name}
          width={item.svg.includes("/logos/") ? 26 : 20}
          height={item.svg.includes("/logos/") ? 26 : 20}
          className="relative z-10 shrink-0 transition-opacity"
          style={
            item.svg.includes("/logos/")
              ? { filter: "grayscale(1)", opacity: isActive ? 0.75 : 0.55 }
              : iconFilter(isActive)
          }
        />
      );
    }
    return null;
  }

  function renderNavLink(item: NavItem, height = "h-[42px]") {
    const isActive = isItemActive(item.href, item.tab);
    const linkHref = item.tab ? `${item.href}?tab=${item.tab}` : item.href;
    return (
      <Link
        href={linkHref}
        onClick={(e) => handleNav(item.href, e, item.tab)}
        onMouseEnter={() => router.prefetch(linkHref)}
        className={`group relative flex items-center gap-3.5 px-3 ${height} rounded-lg transition-all duration-200 overflow-hidden cursor-pointer ${
          isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
        }`}
      >
        {isActive && (
          <div
            className="absolute left-0 top-[15%] bottom-[15%] w-[2px] rounded-full pointer-events-none"
            style={activeBarStyle()}
          />
        )}
        {renderIcon(item, isActive)}
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
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {isInSettings && (
          <div className={`px-3 pb-3 mb-1 border-b ${isLight ? "border-gray-100" : "border-white/[0.06]"}`}>
            <p
              className={`text-[10px] uppercase tracking-[0.12em] font-medium ${
                isLight ? "text-gray-400" : "text-white/30"
              }`}
            >
              {t("settingsHeader")}
            </p>
          </div>
        )}

        {currentNavItems.map((item) => (
          <Fragment key={item.name + (item.tab ?? "")}>
            {renderNavLink(item)}
          </Fragment>
        ))}
      </nav>

      {/* ── ADN de Marca ── */}
      {!isInSettings && (
        <div className="px-3 pb-1">
          <Link
            href="/settings/adn"
            onClick={(e) => handleNav("/settings/adn", e)}
            className={`group relative flex items-center gap-3.5 px-3 h-[42px] rounded-lg transition-all duration-200 overflow-hidden ${
              isItemActive("/settings/adn") ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
            }`}
          >
            {isItemActive("/settings/adn") && (
              <div
                className="absolute left-0 top-[15%] bottom-[15%] w-[2px] rounded-full pointer-events-none"
                style={activeBarStyle()}
              />
            )}
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
              className={`text-[14px] transition-colors relative z-10 flex-1 ${navTextClass(
                isItemActive("/settings/adn")
              )}`}
              style={
                isLight
                  ? { color: isItemActive("/settings/adn") ? BROWN : "rgba(17,17,17,0.56)" }
                  : undefined
              }
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
        </div>
      )}

      {/* ── Settings back link ── */}
      {isInSettings && (
        <div className="px-3 pb-2">
          <Link
            href="/"
            onClick={(e) => handleNav("/", e)}
            className="group flex items-center gap-3 px-3 h-[42px] rounded-lg transition-all duration-200 hover:bg-white/[0.03]"
          >
            <span
              className={`transition-colors text-sm ${
                isLight ? "text-gray-400 group-hover:text-gray-600" : "text-white/30 group-hover:text-white/60"
              }`}
            >
              ←
            </span>
            <span
              className={`text-[13px] font-light tracking-wide transition-colors ${
                isLight ? "text-gray-400 group-hover:text-gray-600" : "text-white/30 group-hover:text-white/60"
              }`}
            >
              {t("backToApp")}
            </span>
          </Link>
        </div>
      )}

      {/* ── Bottom ── */}
      <div
        className={`px-3 py-4 space-y-0.5 border-t ${isLight ? "border-gray-100" : "border-white/[0.06]"}`}
      >
        {/* Más herramientas — expandable accordion */}
        {!isInSettings && (
          <div className="mb-1">
            <button
              onClick={() => setMasHerramientasOpen((prev) => !prev)}
              className="w-full group flex items-center gap-3 px-3 h-[32px] rounded-lg transition-all duration-200 hover:bg-white/[0.03]"
            >
              <Wrench
                size={15}
                strokeWidth={1.5}
                style={{ color: isLight ? "rgba(17,17,17,0.42)" : "rgba(255,255,255,0.38)" }}
              />
              <span
                className="flex-1 text-left text-[14px] tracking-wide font-normal transition-colors"
                style={{ color: isLight ? "rgba(17,17,17,0.50)" : "rgba(255,255,255,0.38)" }}
              >
                {t("masHerramientas")}
              </span>
              <ChevronRight
                size={13}
                strokeWidth={1.5}
                className={`transition-transform duration-200 ${masHerramientasOpen ? "rotate-90" : ""}`}
                style={{ color: isLight ? "rgba(17,17,17,0.22)" : "rgba(255,255,255,0.20)" }}
              />
            </button>
            {masHerramientasOpen && (
              <div className="mt-0.5 space-y-0.5 pl-1">
                {masHerramientasItems.map((item) => {
                  const isActive = isItemActive(item.href, item.tab);
                  const linkHref = item.tab ? `${item.href}?tab=${item.tab}` : item.href;
                  return (
                    <Link
                      key={item.name + (item.tab ?? "")}
                      href={linkHref}
                      onClick={(e) => handleNav(item.href, e, item.tab)}
                      className={`group relative flex items-center gap-3 px-3 h-[34px] rounded-lg transition-all duration-200 overflow-hidden ${
                        isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      {isActive && (
                        <div
                          className="absolute left-0 top-[15%] bottom-[15%] w-[2px] rounded-full pointer-events-none"
                          style={activeBarStyle()}
                        />
                      )}
                      {renderIcon(item, isActive, 16)}
                      <span
                        className={`text-[13px] transition-colors relative z-10 ${navTextClass(isActive)}`}
                        style={
                          isLight ? { color: isActive ? BROWN : "rgba(17,17,17,0.56)" } : undefined
                        }
                      >
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isAdmin && (
          <Link
            href="/admin"
            onClick={(e) => handleNav("/admin", e)}
            className="group relative flex items-center gap-3 px-3 h-[32px] rounded-lg transition-all duration-200 hover:bg-amber-500/[0.05]"
          >
            <Shield
              size={16}
              strokeWidth={1.5}
              className="text-amber-400/60 transition-colors group-hover:text-amber-400"
            />
            <span className="text-[14px] tracking-wide font-normal text-amber-400/60 transition-colors group-hover:text-amber-400">
              {t("admin")}
            </span>
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
