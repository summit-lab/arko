"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTheme } from "./ThemeProvider";

export function NavProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const prevKey = useRef(`${pathname}||${searchParams.toString()}`);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const completeNavigation = useCallback(() => {
    setWidth(100);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 300);
  }, []);

  useEffect(() => {
    const currentKey = `${pathname}||${searchParams.toString()}`;
    if (prevKey.current === currentKey) return;
    prevKey.current = currentKey;
    completeNavigation(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [pathname, searchParams, completeNavigation]);

  // Expose a trigger via a global event
  useEffect(() => {
    const handler = () => {
      setVisible(true);
      setWidth(15);
      if (animRef.current) clearInterval(animRef.current);
      animRef.current = setInterval(() => {
        setWidth((w) => {
          if (w >= 85) {
            clearInterval(animRef.current!);
            return 85;
          }
          return w + Math.random() * 10;
        });
      }, 200);
    };
    window.addEventListener("nav:start", handler);
    return () => window.removeEventListener("nav:start", handler);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none">
      <div
        style={{
          width: `${width}%`,
          height: "100%",
          background: isLight
            ? "linear-gradient(to right, rgba(124,59,15,0.7), rgba(124,59,15,1))"
            : "linear-gradient(to right, rgba(255,255,255,0.5), rgba(255,255,255,0.95))",
          transition: width === 100 ? "width 0.2s ease-out" : "width 0.4s ease-out",
          boxShadow: isLight ? "0 0 10px rgba(124,59,15,0.45)" : "0 0 8px rgba(255,255,255,0.4)",
        }}
      />
    </div>
  );
}
