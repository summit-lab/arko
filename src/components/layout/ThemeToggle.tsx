"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="h-9 w-9 flex items-center justify-center rounded-xl transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95"
      style={
        isDark
          ? {
              background: "linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(251,146,60,0.10) 100%)",
              border: "1px solid rgba(251,191,36,0.35)",
              color: "#fbbf24",
              boxShadow: "0 0 12px rgba(251,191,36,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
            }
          : {
              background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)",
              border: "1px solid rgba(99,102,241,0.35)",
              color: "#6366f1",
              boxShadow: "0 0 12px rgba(99,102,241,0.20), inset 0 1px 0 rgba(255,255,255,0.5)",
            }
      }
    >
      {isDark ? (
        <Sun className="h-4 w-4" strokeWidth={2} />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={2} />
      )}
    </button>
  );
}
