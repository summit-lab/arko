"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useTransition, useCallback } from "react";
import {
  LayoutGrid,
  Building2,
  Mail,
  ArrowLeft,
  Shield,
} from "lucide-react";

const navItems = [
  { name: "Dashboard",    href: "/admin",             icon: LayoutGrid },
  { name: "Clientes",     href: "/admin/clients",     icon: Building2 },
  { name: "Invitaciones", href: "/admin/invitations",  icon: Mail },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setOptimisticHref(null);
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

  function isItemActive(href: string) {
    return href === "/admin" ? activeHref === "/admin" : activeHref.startsWith(href);
  }

  return (
    <aside
      className="w-[220px] h-screen fixed left-0 top-0 z-40 flex flex-col"
      style={{ background: "rgba(0, 0, 0, 0.6)", borderRight: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-5 shrink-0">
        <Shield size={20} className="text-amber-400/80" />
        <div className="leading-none">
          <p className="text-[18px] font-medium tracking-tight text-white leading-none">
            Admin
          </p>
          <p className="text-[10px] mt-1 text-white/30 font-medium tracking-wider uppercase">
            Panel
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
              className={`group relative flex items-center gap-3 px-3 h-[40px] rounded-lg transition-all duration-200 overflow-hidden ${
                isActive
                  ? "bg-white/[0.06]"
                  : "hover:bg-white/[0.03]"
              }`}
            >
              {isActive && (
                <div
                  className="absolute left-0 top-[15%] bottom-[15%] w-[2px] rounded-full pointer-events-none"
                  style={{
                    background: "linear-gradient(to bottom, rgba(251,191,36,0.1) 0%, rgba(251,191,36,0.9) 50%, rgba(251,191,36,0.1) 100%)",
                    boxShadow: "0 0 8px rgba(251, 191, 36, 0.3)",
                  }}
                />
              )}

              <item.icon
                size={18}
                strokeWidth={isActive ? 2 : 1.5}
                className="transition-colors relative z-10 shrink-0"
                style={{ color: isActive ? "#fbbf24" : "rgba(255, 255, 255, 0.4)" }}
              />
              <span
                className={`text-[13px] transition-colors relative z-10 ${
                  isActive
                    ? "font-medium text-white tracking-wide"
                    : "font-light text-white/40 group-hover:text-white/65 tracking-wide"
                }`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom ── */}
      <div className="px-3 py-6 border-t border-white/[0.06]">
        <Link
          href="/"
          onClick={(e) => handleNav("/", e)}
          className="group flex items-center gap-2.5 px-3 h-[36px] rounded-lg transition-all duration-200 hover:bg-white/[0.03]"
        >
          <ArrowLeft size={16} strokeWidth={1.5} className="text-white/40 group-hover:text-white/70" />
          <span className="text-[13px] tracking-wide font-light text-white/40 group-hover:text-white/70">
            Volver a Arko
          </span>
        </Link>
      </div>
    </aside>
  );
}
