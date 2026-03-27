"use client";

import { useEffect, useRef } from "react";

export function AmbientGlow() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const glow = glowRef.current;
    if (!glow) return;

    let rafId = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let visible = false;

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }

    function animate() {
      currentX = lerp(currentX, targetX, 0.08);
      currentY = lerp(currentY, targetY, 0.08);
      if (glow) {
        glow.style.transform = `translate(${currentX - 200}px, ${currentY - 200}px)`;
      }
      rafId = requestAnimationFrame(animate);
    }

    function onMove(e: MouseEvent) {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!visible && glow) {
        glow.style.opacity = "1";
        visible = true;
      }
    }

    function onLeave() {
      if (glow) {
        glow.style.opacity = "0";
        visible = false;
      }
    }

    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    rafId = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={glowRef}
      className="fixed top-0 left-0 pointer-events-none z-[1]"
      style={{
        width: 400,
        height: 400,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,230,180,0.025) 0%, rgba(210,180,140,0.012) 30%, transparent 70%)",
        opacity: 0,
        transition: "opacity 0.4s ease",
        willChange: "transform",
      }}
    />
  );
}
