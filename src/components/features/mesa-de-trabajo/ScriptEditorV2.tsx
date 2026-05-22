"use client";

import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Extension } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import UnderlineExt from "@tiptap/extension-underline";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import { Link as LinkExt } from "@tiptap/extension-link";
import { Suggestion } from "@tiptap/suggestion";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2,
  List, ListOrdered, Quote, Link2, Type, MessageSquarePlus,
} from "lucide-react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { CommentMark } from "./tiptap-comment-mark";

// ─── Slash command items ──────────────────────────────────────────────────────

type CommandItem = {
  title: string;
  description: string;
  shortcut?: string;
  icon: React.ReactNode;
  command: (editor: Editor, range: Range) => void;
};

function getCommandItems({ query }: { query: string }): CommandItem[] {
  const all: CommandItem[] = [
    {
      title: "Texto",
      description: "Párrafo normal",
      icon: <Type size={14} />,
      command: (editor, range) => editor.chain().focus().deleteRange(range).setParagraph().run(),
    },
    {
      title: "Título 1",
      description: "Sección grande",
      shortcut: "#",
      icon: <Heading1 size={14} />,
      command: (editor, range) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
    },
    {
      title: "Título 2",
      description: "Sección mediana",
      shortcut: "##",
      icon: <Heading2 size={14} />,
      command: (editor, range) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
    },
    {
      title: "Lista",
      description: "Lista con viñetas",
      shortcut: "-",
      icon: <List size={14} />,
      command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      title: "Lista numerada",
      description: "Lista 1, 2, 3…",
      shortcut: "1.",
      icon: <ListOrdered size={14} />,
      command: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
      title: "Cita",
      description: "Bloque de cita",
      shortcut: ">",
      icon: <Quote size={14} />,
      command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
  ];
  if (!query) return all;
  const q = query.toLowerCase();
  return all.filter((c) => c.title.toLowerCase().includes(q));
}

// ─── Slash menu popover (rendered via tippy) ──────────────────────────────────

interface SlashMenuProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
  isLight: boolean;
}

interface SlashMenuHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(({ items, command, isLight }, ref) => {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowDown") {
        setSelected((s) => (s + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelected((s) => (s - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = items[selected];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  const bg     = isLight ? "white" : "rgba(20,20,22,0.99)";
  const border = isLight ? "rgba(17,17,17,0.10)" : "rgba(255,255,255,0.09)";
  const text   = isLight ? "#111111" : "rgba(255,255,255,0.88)";
  const sub    = isLight ? "rgba(17,17,17,0.45)" : "rgba(255,255,255,0.38)";
  const active = isLight ? "rgba(17,17,17,0.06)" : "rgba(255,255,255,0.08)";

  if (items.length === 0) {
    return (
      <div
        className="rounded-xl px-4 py-3"
        style={{ background: bg, border: `1px solid ${border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}
      >
        <p className="text-[12px]" style={{ color: sub }}>Sin resultados</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl py-1.5 min-w-[240px]"
      style={{ background: bg, border: `1px solid ${border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}
    >
      {items.map((it, idx) => (
        <button
          key={it.title}
          onClick={() => command(it)}
          onMouseEnter={() => setSelected(idx)}
          className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
          style={{
            background: idx === selected ? active : "transparent",
            color: text,
          }}
        >
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{ background: isLight ? "rgba(17,17,17,0.04)" : "rgba(255,255,255,0.04)", color: text }}
          >
            {it.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-medium" style={{ color: text }}>{it.title}</p>
            <p className="text-[10.5px]" style={{ color: sub }}>{it.description}</p>
          </div>
          {it.shortcut && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: isLight ? "rgba(17,17,17,0.04)" : "rgba(255,255,255,0.04)",
                color: sub,
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {it.shortcut}
            </span>
          )}
        </button>
      ))}
    </div>
  );
});

SlashMenu.displayName = "SlashMenu";

// ─── Slash command extension factory ──────────────────────────────────────────

function createSlashCommand(isLight: boolean) {
  return Extension.create({
    name: "slashCommand",
    addOptions() {
      return {
        suggestion: {
          char: "/",
          startOfLine: false,
          command: ({ editor, range, props }: { editor: Editor; range: Range; props: CommandItem }) => {
            props.command(editor, range);
          },
        },
      };
    },
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...this.options.suggestion,
          items: getCommandItems,
          render: () => {
            let component: ReactRenderer<SlashMenuHandle, SlashMenuProps> | null = null;
            let popup: TippyInstance[] | null = null;

            return {
              onStart: (props) => {
                component = new ReactRenderer(SlashMenu, {
                  props: { items: props.items as CommandItem[], command: props.command, isLight },
                  editor: props.editor,
                });
                const clientRect = props.clientRect;
                if (!clientRect) return;
                popup = tippy("body", {
                  getReferenceClientRect: () => clientRect() ?? new DOMRect(),
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                });
              },
              onUpdate: (props) => {
                component?.updateProps({ items: props.items as CommandItem[], command: props.command, isLight });
                const clientRect = props.clientRect;
                if (popup && clientRect) {
                  popup[0]?.setProps({
                    getReferenceClientRect: () => clientRect() ?? new DOMRect(),
                  });
                }
              },
              onKeyDown: (props) => {
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide();
                  return true;
                }
                return component?.ref?.onKeyDown({ event: props.event }) ?? false;
              },
              onExit: () => {
                popup?.[0]?.destroy();
                component?.destroy();
              },
            };
          },
        }),
      ];
    },
  });
}

// ─── ScriptEditor v2 ──────────────────────────────────────────────────────────

const PALETTE = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];

interface ScriptEditorV2Props {
  initialHtml: string;
  onChange: (html: string) => void;
  isLight: boolean;
  maxWidth?: number;
  /** Llamado cuando el usuario clickea "Comentar" sobre una selección.
   *  El padre genera el commentId y lo guarda en DB. El editor ya aplicó la marca
   *  con ese commentId provisional, así que el padre solo debe persistir.
   *  El texto citado se incluye para mostrar contexto. */
  onCommentCreate?: (args: { commentId: string; quotedText: string }) => void;
  /** Llamado cuando el usuario clickea sobre una marca de comentario existente. */
  onCommentClick?: (commentId: string) => void;
}

/** Handle imperativo que el padre usa para inyectar cambios externos
 *  (ej. cuando Moka aplica una propuesta, o cuando se restaura una versión)
 *  SIN perder el undo stack del editor. */
export interface ScriptEditorV2Handle {
  /** Reemplaza el contenido del editor manteniendo la historia (Ctrl+Z deshace este cambio). */
  applyExternalContent: (html: string) => void;
  /** Devuelve el HTML actual normalizado por TipTap. Útil tras un applyExternalContent
   *  para sincronizar `lastSaved` y evitar auto-saves espurios por re-serialización. */
  getHTML: () => string;
  /** Quita la marca de comentario del documento (cuando el comentario se borra). */
  removeCommentMark: (commentId: string) => void;
  /** Scrollea el editor hasta el primer span con ese commentId. */
  scrollToComment: (commentId: string) => void;
  /** Devuelve el rect de cada marca de comentario, para sincronizar el panel lateral. */
  getCommentAnchorRects: () => Array<{ commentId: string; top: number }>;
}

/** Genera un UUID v4-like para identificar comentarios. Prefiere `crypto.randomUUID`
 *  cuando está disponible (HTTPS o localhost). En fallback combina time + 16 bytes
 *  random de crypto.getRandomValues para minimizar colisiones (~10^-19). */
function generateCommentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as { randomUUID: () => string }).randomUUID();
  }
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(16);
    (crypto as Crypto).getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `c-${hex}`;
  }
  // Último recurso (entornos sin Web Crypto API)
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 14)}-${Math.random().toString(36).slice(2, 14)}`;
}

export const ScriptEditorV2 = forwardRef<ScriptEditorV2Handle, ScriptEditorV2Props>(function ScriptEditorV2(
  { initialHtml, onChange, isLight, maxWidth = 720, onCommentCreate, onCommentClick },
  ref,
) {
  const [showColors, setShowColors] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Sin título";
          return "Escribí, o tipeá '/' para insertar bloques…";
        },
      }),
      UnderlineExt,
      TextStyle,
      Color,
      LinkExt.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: "tiptap-link" },
      }),
      CommentMark,
      createSlashCommand(isLight),
    ],
    content: initialHtml || "<p></p>",
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class: "tiptap-body outline-none",
      },
    },
    immediatelyRender: false,
  });

  // Expongo el método applyExternalContent al padre.
  // Usa setContent dentro de un chain con focus para que ProseMirror registre la
  // transacción en el undo stack — así Ctrl+Z deshace los cambios de Moka como
  // si fueran ediciones normales.
  useImperativeHandle(ref, () => ({
    applyExternalContent: (html: string) => {
      if (!editor) return;
      editor.chain().focus().setContent(html || "<p></p>", { emitUpdate: true }).run();
    },
    getHTML: () => editor?.getHTML() ?? "",
    removeCommentMark: (commentId: string) => {
      if (!editor) return;
      editor.chain().focus().removeCommentById(commentId).run();
    },
    scrollToComment: (commentId: string) => {
      if (typeof document === "undefined") return;
      const el = document.querySelector(`[data-comment-id="${commentId}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Flash sutil
        el.classList.add("comment-mark-flash");
        window.setTimeout(() => el.classList.remove("comment-mark-flash"), 800);
      }
    },
    getCommentAnchorRects: () => {
      if (typeof document === "undefined") return [];
      const nodes = document.querySelectorAll<HTMLElement>("[data-comment-id]");
      // Agrupamos por commentId (un comentario puede aparecer en varios spans
      // si el rango cruza nodos) y devolvemos el top del primero.
      const byId = new Map<string, number>();
      for (const node of nodes) {
        const id = node.getAttribute("data-comment-id");
        if (!id || byId.has(id)) continue;
        const rect = node.getBoundingClientRect();
        byId.set(id, rect.top + window.scrollY);
      }
      return Array.from(byId.entries()).map(([commentId, top]) => ({ commentId, top }));
    },
  }), [editor]);

  // Click en una marca de comentario → callback al padre.
  useEffect(() => {
    if (!editor || !onCommentClick) return;
    const dom = editor.view.dom;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const mark = target.closest("[data-comment-id]") as HTMLElement | null;
      if (mark) {
        const id = mark.getAttribute("data-comment-id");
        if (id) onCommentClick(id);
      }
    };
    dom.addEventListener("click", handler);
    return () => dom.removeEventListener("click", handler);
  }, [editor, onCommentClick]);

  // Keyboard shortcut: Cmd/Ctrl+K → link prompt
  useEffect(() => {
    if (!editor) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const previous = editor.getAttributes("link").href as string | undefined;
        const url = window.prompt("URL del enlace", previous ?? "https://");
        if (url === null) return;
        if (url === "") {
          editor.chain().focus().extendMarkRange("link").unsetLink().run();
          return;
        }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor]);

  const textMain = isLight ? "#111111" : "rgba(255,255,255,0.92)";
  const textSub  = isLight ? "rgba(17,17,17,0.45)" : "rgba(255,255,255,0.38)";
  const border   = isLight ? "rgba(17,17,17,0.10)" : "rgba(255,255,255,0.10)";
  const bubbleBg = isLight ? "white" : "rgba(20,20,22,0.99)";
  const btnHover = isLight ? "rgba(17,17,17,0.06)" : "rgba(255,255,255,0.08)";

  const currentColor = editor?.getAttributes("textStyle").color as string | undefined;
  const isLinkActive = editor?.isActive("link") ?? false;

  const bubbleBtn = (active: boolean, onClick: () => void, title: string, icon: React.ReactNode) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-7 h-7 rounded-md flex items-center justify-center transition-all"
      style={{
        background: active ? btnHover : "transparent",
        color: active ? textMain : textSub,
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = btnHover; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {icon}
    </button>
  );

  function promptLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL del enlace", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-none">
      <style>{`
        .tiptap-body { font-size: 16px; line-height: 1.7; color: ${textMain}; font-weight: 400; letter-spacing: 0.005em; min-height: 60vh; }
        .tiptap-body h1 { font-size: 1.9em; font-weight: 600; margin: 0.8em 0 0.3em; letter-spacing: -0.01em; }
        .tiptap-body h2 { font-size: 1.45em; font-weight: 600; margin: 0.7em 0 0.25em; letter-spacing: -0.005em; }
        .tiptap-body p { margin: 0.4em 0; }
        .tiptap-body ul { list-style-type: disc; padding-left: 1.5em; margin: 0.4em 0; }
        .tiptap-body ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.4em 0; }
        .tiptap-body li { margin: 0.15em 0; }
        .tiptap-body li > p { margin: 0; }
        .tiptap-body blockquote {
          border-left: 3px solid ${border};
          padding: 0.1em 0 0.1em 1em;
          margin: 0.6em 0;
          color: ${textSub};
          font-style: italic;
        }
        .tiptap-body strong { font-weight: 700; }
        .tiptap-body em { font-style: italic; }
        .tiptap-body u { text-decoration: underline; }
        .tiptap-body .tiptap-link { color: rgb(59,130,246); text-decoration: underline; cursor: pointer; }
        .tiptap-body p.is-editor-empty:first-child::before,
        .tiptap-body h1.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          pointer-events: none;
          height: 0;
          color: ${textSub};
        }
        .tippy-box { background: transparent !important; }
        .tippy-box .tippy-content { padding: 0 !important; }
      `}</style>

      {editor && (
        <BubbleMenu
          editor={editor}
          className="flex items-center gap-0.5 rounded-xl p-1"
          style={{
            background: bubbleBg,
            border: `1px solid ${border}`,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          }}
        >
          {bubbleBtn(editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), "Título 1", <Heading1 size={13} />)}
          {bubbleBtn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "Título 2", <Heading2 size={13} />)}
          <div className="w-px h-4 mx-0.5" style={{ background: border }} />
          {bubbleBtn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "Negrita (⌘B)", <Bold size={13} />)}
          {bubbleBtn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "Cursiva (⌘I)", <Italic size={13} />)}
          {bubbleBtn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), "Subrayado (⌘U)", <UnderlineIcon size={13} />)}
          <div className="w-px h-4 mx-0.5" style={{ background: border }} />
          {bubbleBtn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "Lista", <List size={13} />)}
          {bubbleBtn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "Lista numerada", <ListOrdered size={13} />)}
          <div className="w-px h-4 mx-0.5" style={{ background: border }} />
          {bubbleBtn(isLinkActive, promptLink, "Enlace (⌘K)", <Link2 size={13} />)}
          {/* Color */}
          <div className="relative">
            <button
              type="button"
              title="Color"
              onClick={() => setShowColors((v) => !v)}
              className="w-7 h-7 rounded-md flex flex-col items-center justify-center gap-0.5 transition-all"
              style={{
                background: showColors ? btnHover : "transparent",
              }}
              onMouseEnter={(e) => { if (!showColors) (e.currentTarget as HTMLElement).style.background = btnHover; }}
              onMouseLeave={(e) => { if (!showColors) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1, color: currentColor ?? textMain }}>A</span>
              <span className="w-3 h-0.5 rounded-full" style={{ background: currentColor ?? textSub }} />
            </button>
            {showColors && (
              <div
                className="absolute top-full right-0 mt-1.5 flex items-center gap-1.5 p-2 rounded-xl z-20"
                style={{
                  background: bubbleBg,
                  border: `1px solid ${border}`,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                }}
              >
                <button
                  type="button"
                  title="Color por defecto"
                  onClick={() => { editor.chain().focus().unsetColor().run(); setShowColors(false); }}
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: border }}
                >
                  <span style={{ fontSize: 8, color: textSub }}>✕</span>
                </button>
                {PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => { editor.chain().focus().setColor(color).run(); setShowColors(false); }}
                    className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                    style={{
                      background: color,
                      outline: currentColor === color ? `2px solid ${color}` : "none",
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          {/* Comentar */}
          {onCommentCreate && (
            <>
              <div className="w-px h-4 mx-0.5" style={{ background: border }} />
              {bubbleBtn(
                false,
                () => {
                  const { from, to, empty } = editor.state.selection;
                  if (empty) return;
                  const quotedText = editor.state.doc.textBetween(from, to, " ");
                  const newId = generateCommentId();
                  editor.chain().focus().setComment(newId).run();
                  onCommentCreate({ commentId: newId, quotedText });
                },
                "Comentar",
                <MessageSquarePlus size={13} />,
              )}
            </>
          )}
        </BubbleMenu>
      )}

      <div className="mx-auto px-8 py-10" style={{ maxWidth }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});
