/**
 * CommentMark — TipTap Mark que ancla un rango del documento a un comentario.
 *
 * Cada comentario en `script_comments` puede tener un `comment_id` (UUID).
 * El editor guarda ese ID como atributo `data-comment-id` en la marca, así
 * el ancla viaja con el texto a través de ediciones (insert, delete, paste).
 *
 * Si el texto comentado se borra entero, la marca desaparece pero el comentario
 * en DB queda como "huérfano" — sigue visible en el panel sin highlight.
 */

import { Mark, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    commentMark: {
      /** Aplica la marca al rango actualmente seleccionado. */
      setComment: (commentId: string) => ReturnType;
      /** Quita la marca de la selección actual. */
      unsetComment: () => ReturnType;
      /** Quita TODAS las marcas con ese commentId del documento entero. */
      removeCommentById: (commentId: string) => ReturnType;
    };
  }
}

export const CommentMark = Mark.create({
  name: "commentMark",

  // No especificamos `excludes` para usar el default de ProseMirror: una mark del
  // mismo type se excluye a sí misma — si el usuario comenta texto que ya tiene
  // otra marca de comentario, la nueva reemplaza a la vieja en el rango común.
  inclusive: false,

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-comment-id"),
        renderHTML: (attrs) =>
          attrs.commentId ? { "data-comment-id": attrs.commentId } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-comment-id]",
        getAttrs: (el) => {
          const id = (el as HTMLElement).getAttribute("data-comment-id");
          return id ? { commentId: id } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "comment-mark" }),
      0,
    ];
  },

  addCommands() {
    return {
      setComment:
        (commentId: string) =>
        ({ commands }) =>
          commands.setMark("commentMark", { commentId }),
      unsetComment:
        () =>
        ({ commands }) =>
          commands.unsetMark("commentMark"),
      removeCommentById:
        (commentId: string) =>
        ({ tr, state, dispatch }) => {
          if (!commentId) return false;
          const { doc } = state;
          const markType = state.schema.marks.commentMark;
          if (!markType) return false;

          let changed = false;
          doc.descendants((node, pos) => {
            if (!node.isText) return;
            for (const mark of node.marks) {
              if (mark.type === markType && mark.attrs.commentId === commentId) {
                tr.removeMark(pos, pos + node.nodeSize, markType);
                changed = true;
              }
            }
          });
          if (changed && dispatch) dispatch(tr);
          return changed;
        },
    };
  },
});
