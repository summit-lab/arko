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
      className="h-8 w-8 flex items-center justify-center rounded-xl transition-all duration-300 cursor-pointer"
      style={
        isDark
          ? {
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.4)",
            }
          : {
              background: "rgba(0,0,0,0.06)",
              border: "1px solid rgba(0,0,0,0.1)",
              color: "rgba(0,0,0,0.5)",
            }
      }
    >
      {isDark ? (
        <Sun className="h-3.5 w-3.5" strokeWidth={1.8} />
      ) : (
        <Moon className="h-3.5 w-3.5" strokeWidth={1.8} />
      )}
    </button>
  );
}
