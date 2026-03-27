"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";

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

// ─── Arko Logo SVG (shared) ─────────────────────────────────────────────────

export function ArkoLogoSmall({ size = 9, opacity = 0.5 }: { size?: number; opacity?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 607.13 523.93"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill={`rgba(255,255,255,${opacity})`}
        d="M412.55,17.53c-4.06-10.56-14.2-17.53-25.51-17.53h-185.69l-.23.57,79.73,207.46s0,.05.02.09c.66,3.31,4.16,22.81-8.98,40.42-12.23,16.41-30.03,19.33-33.45,19.83h-121.46c-11.31,0-21.46,6.97-25.51,17.53L0,523.93h204.93l77.56-201.82c3.56-7.38,11.97-22.46,28.68-35.1,1.71-1.33,3.54-2.61,5.44-3.84,16-10.42,31.4-13.64,40.08-14.78h152.26L412.55,17.53Z"
      />
      <path
        fill={`rgba(255,255,255,${opacity})`}
        d="M607.13,523.93h-204.93l-23.47-61.08c-18.53-49.04,6.47-104.64,55.35-123.28,48.72-18.58,104.22,5.99,123.21,54.68l49.84,129.68Z"
      />
    </svg>
  );
}

// ─── Markdown rendering ─────────────────────────────────────────────────────

export function renderInline(text: string): React.ReactNode {
  return text
    .split(/(\*\*.*?\*\*|`.*?`)/g)
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-white/85">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[12px] text-white/70 font-mono"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={i}>{part}</span>;
    });
}

export function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="list-disc list-inside space-y-1 my-2">
          {listItems}
        </ul>,
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h4 key={i} className="text-[13px] font-semibold text-white/80 mt-3 mb-1">
          {renderInline(line.slice(4))}
        </h4>,
      );
    } else if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h3 key={i} className="text-[14px] font-semibold text-white/85 mt-3 mb-1">
          {renderInline(line.slice(3))}
        </h3>,
      );
    } else if (/^[-*] /.test(line)) {
      listItems.push(
        <li key={i} className="text-white/65">
          {renderInline(line.replace(/^[-*] /, ""))}
        </li>,
      );
    } else if (/^\d+\. /.test(line)) {
      listItems.push(
        <li key={i} className="text-white/65">
          {renderInline(line.replace(/^\d+\. /, ""))}
        </li>,
      );
    } else {
      flushList();
      if (line.trim() === "") {
        elements.push(<br key={i} />);
      } else {
        elements.push(
          <span key={i}>
            {renderInline(line)}
            {i < lines.length - 1 ? "\n" : ""}
          </span>,
        );
      }
    }
  }
  flushList();

  return elements;
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
        <div className="max-w-[70%] rounded-xl px-6 py-3.5 text-[13.5px] leading-relaxed bg-white/[0.07] border border-white/[0.06] text-white/75">
          <div className="whitespace-pre-wrap font-light">
            {renderMarkdown(content)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-xl px-6 py-3.5 text-[13.5px] leading-relaxed bg-white/[0.04] border border-white/[0.06] text-white/65">
        <div className="flex items-center gap-1.5 mb-2.5">
          <div className="h-4 w-4 rounded-full bg-gradient-to-b from-white/12 to-white/4 flex items-center justify-center">
            <ArkoLogoSmall />
          </div>
          <span className="text-[10px] font-medium text-white/30 tracking-wide">
            Arko
          </span>
        </div>
        <div className="whitespace-pre-wrap font-light">
          {renderMarkdown(content)}
        </div>
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
      <div className="max-w-[85%] rounded-xl px-5 py-4 bg-white/[0.04] border border-white/[0.06]">
        <div className="flex items-center gap-1.5 mb-3">
          <div className="h-4 w-4 rounded-full bg-gradient-to-b from-white/12 to-white/4 flex items-center justify-center">
            <ArkoLogoSmall />
          </div>
          <span className="text-[10px] font-medium text-white/30 tracking-wide">
            Arko
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
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/60 shrink-0" />
              )}
              <span
                className={`text-[12px] font-light transition-colors duration-300 ${
                  step.status === "running"
                    ? "text-white/50"
                    : "text-white/30"
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
              <span className="text-[12px] font-light text-white/50">
                {statusLabel}
              </span>
            </div>
          )}

          {!statusLabel && toolSteps.length === 0 && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-white/25 animate-pulse"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="h-1.5 w-1.5 rounded-full bg-white/25 animate-pulse"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="h-1.5 w-1.5 rounded-full bg-white/25 animate-pulse"
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
                : "bg-white/[0.07] border border-white/[0.06] w-[40%]"
            }`}
          >
            <div className="h-3 w-3/4 rounded bg-white/[0.06] mb-2" />
            <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}
