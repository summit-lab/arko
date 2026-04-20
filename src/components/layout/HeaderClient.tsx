"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export function HeaderClient() {
  const [date, setDate] = useState("");

  useEffect(() => {
    const now = new Date();
    const formatted = now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    setDate(formatted);
  }, []);

  if (!date) return null;

  return (
    <>
      <div className="hidden md:flex items-center gap-2 h-8 px-3 rounded-xl bg-accent/60 border border-border">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
        <span className="text-[11px] text-muted-foreground font-light">{date}</span>
      </div>
      <ThemeToggle />
    </>
  );
}
