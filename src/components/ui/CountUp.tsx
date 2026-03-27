"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";

interface CountUpProps {
  value: string;
  className?: string;
  duration?: number;
}

function parseValue(val: string): { num: number; suffix: string; prefix: string; decimals: number } {
  const prefix = val.match(/^[^0-9.]*/)?.[0] || "";
  const suffix = val.match(/[^0-9.]*$/)?.[0] || "";
  const numStr = val.replace(prefix, "").replace(suffix, "");
  const num = parseFloat(numStr) || 0;
  const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
  return { num, suffix, prefix, decimals };
}

export function CountUp({ value, className = "", duration = 1200 }: CountUpProps) {
  const pathname = usePathname();
  const [display, setDisplay] = useState("0");
  const [animKey, setAnimKey] = useState(0);
  const rafRef = useRef<number>(0);

  const runAnimation = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const { num, suffix, prefix, decimals } = parseValue(value);
    if (num === 0) { setDisplay(value); return; }

    setDisplay(`${prefix}${(0).toFixed(decimals)}${suffix}`);
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * num;

      setDisplay(`${prefix}${current.toFixed(decimals)}${suffix}`);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(value);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [value, duration]);

  useEffect(() => {
    setAnimKey((k) => k + 1);
    runAnimation();
    return () => cancelAnimationFrame(rafRef.current);
  }, [pathname, runAnimation]);

  return (
    <span
      key={animKey}
      className={className}
      style={{ animation: "countFadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both" }}
    >
      {display}
    </span>
  );
}
