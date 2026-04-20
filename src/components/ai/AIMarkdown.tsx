"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AIMarkdownProps {
  children: string | null | undefined;
  className?: string;
  variant?: "default" | "compact";
}

/**
 * Renders AI-generated text (Gemini, Claude, OpenAI) as real Markdown.
 * Handles bold, italic, headings, lists, tables, links, inline code, code blocks.
 * Works in both dark and light themes (uses prose-invert inside .dark context via CSS).
 *
 * Use anywhere AI prose is shown — chat messages, analysis modals, ADN replies.
 */
export function AIMarkdown({ children, className = "", variant = "default" }: AIMarkdownProps) {
  if (!children) return null;

  const compact = variant === "compact";

  return (
    <div
      className={[
        "prose prose-sm max-w-none",
        // Theme-aware: light mode default, dark: swap via `prose-invert` under .dark
        "prose-neutral dark:prose-invert",
        // Typography tokens tuned to the app's density
        "prose-headings:font-semibold prose-headings:tracking-tight",
        compact ? "prose-h1:text-[14px] prose-h2:text-[13px] prose-h3:text-[12px]" : "prose-h1:text-[16px] prose-h2:text-[14px] prose-h3:text-[13px]",
        "prose-h1:mt-4 prose-h1:mb-2 prose-h2:mt-3 prose-h2:mb-1.5 prose-h3:mt-2.5 prose-h3:mb-1",
        compact ? "prose-p:text-[12.5px]" : "prose-p:text-[13.5px]",
        "prose-p:leading-relaxed prose-p:my-1.5",
        "prose-strong:font-semibold",
        "prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5",
        compact ? "prose-li:text-[12.5px]" : "prose-li:text-[13.5px]",
        "prose-li:leading-relaxed",
        "prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[12px]",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-code:bg-muted prose-code:text-foreground",
        "prose-pre:bg-muted prose-pre:text-foreground prose-pre:text-[12px] prose-pre:my-2 prose-pre:rounded-md",
        "prose-a:text-primary prose-a:underline-offset-2 hover:prose-a:opacity-80",
        "prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:text-foreground/70",
        "prose-hr:border-border prose-hr:my-4",
        "prose-table:text-[12.5px] prose-th:text-foreground prose-td:text-foreground/85",
        className,
      ].join(" ")}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
