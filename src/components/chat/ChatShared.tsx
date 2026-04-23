"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";
import { AIMarkdown } from "@/components/ai/AIMarkdown";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ToolStep {
  tool: string;
  label: string;
  status: "running" | "done";
}

// ─── Moka Logo (shared) ─────────────────────────────────────────────────────
// Antes era un SVG inline con fill adaptativo al tema. Ahora usa el SVG del
// brand para que sea consistente en todos los contextos.
// eslint-disable-next-line @next/next/no-img-element
export function ArkoLogoSmall({
  size = 9,
  opacity = 0.5,
  className,
}: {
  size?: number;
  opacity?: number;
  className?: string;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/logos/moka.svg"
      alt="Moka"
      width={size}
      height={size}
      className={className}
      style={{ opacity, width: size, height: size, objectFit: "contain" }}
    />
  );
}

// ─── ArkoMessage ────────────────────────────────────────────────────────────

export function ArkoMessage({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] rounded-xl px-6 py-3.5 text-[13.5px] leading-relaxed bg-primary text-primary-foreground">
          <div className="whitespace-pre-wrap">{content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-xl px-6 py-3.5 bg-muted border border-border text-foreground/90">
        <div className="flex items-center gap-1.5 mb-2.5">
          <div className="h-4 w-4 rounded-full bg-accent border border-border flex items-center justify-center">
            <ArkoLogoSmall />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground tracking-wide">
            Moka
          </span>
        </div>
        <AIMarkdown>{content}</AIMarkdown>
      </div>
    </div>
  );
}

// ─── ThinkingIndicator (Perplexity-style) ───────────────────────────────────

export function ThinkingIndicator({
  statusLabel,
  toolSteps,
}: {
  statusLabel: string | null;
  toolSteps: ToolStep[];
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-xl px-5 py-4 bg-muted border border-border">
        <div className="flex items-center gap-1.5 mb-3">
          <div className="h-4 w-4 rounded-full bg-accent border border-border flex items-center justify-center">
            <ArkoLogoSmall />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground tracking-wide">
            Moka
          </span>
        </div>

        <div className="space-y-2">
          {toolSteps.map((step, i) => (
            <div
              key={`${step.tool}-${i}`}
              className="flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-300"
            >
              {step.status === "running" ? (
                <div className="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full border border-violet-400/60 border-t-transparent animate-spin" />
                </div>
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              )}
              <span
                className={`text-[12px] font-light transition-colors duration-300 ${
                  step.status === "running"
                    ? "text-foreground/70"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}

          {statusLabel && (
            <div className="flex items-center gap-2.5 animate-in fade-in duration-300">
              <div className="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full border border-violet-400/60 border-t-transparent animate-spin" />
              </div>
              <span className="text-[12px] font-light text-foreground/70">
                {statusLabel}
              </span>
            </div>
          )}

          {!statusLabel && toolSteps.length === 0 && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MessagesSkeleton ───────────────────────────────────────────────────────

export function MessagesSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
        >
          <div
            className={`rounded-xl px-6 py-4 ${
              i % 2 === 0
                ? "glass-card w-[60%]"
                : "bg-accent border border-border w-[40%]"
            }`}
          >
            <div className="h-3 w-3/4 rounded bg-muted-foreground/20 mb-2" />
            <div className="h-3 w-1/2 rounded bg-muted-foreground/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
