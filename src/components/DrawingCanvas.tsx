"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { Tldraw, Editor } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";

export interface DrawingCanvasRef {
  exportPng: () => Promise<Blob | null>;
  clear: () => void;
  isEmpty: () => boolean;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, { className?: string; fillHeight?: boolean }>(
  function DrawingCanvas({ className, fillHeight }, ref) {
    const editorRef = useRef<Editor | null>(null);

    useImperativeHandle(ref, () => ({
      exportPng: async () => {
        const editor = editorRef.current;
        if (!editor) return null;
        const ids = [...editor.getCurrentPageShapeIds()];
        if (ids.length === 0) return null;
        try {
          const { blob } = await editor.toImage(ids, { format: "png", background: true });
          return blob;
        } catch {
          return null;
        }
      },
      clear: () => {
        const editor = editorRef.current;
        if (!editor) return;
        const ids = [...editor.getCurrentPageShapeIds()];
        if (ids.length > 0) editor.deleteShapes(ids);
      },
      isEmpty: () => {
        const editor = editorRef.current;
        if (!editor) return true;
        return editor.getCurrentPageShapeIds().size === 0;
      },
    }));

    return (
      <div
        className={className}
        style={{ height: fillHeight ? "100%" : "420px", position: "relative" }}
      >
        <Tldraw
          onMount={(editor: Editor) => {
            editorRef.current = editor;
            // Start in freehand draw mode
            editor.setCurrentTool("draw");
          }}
        />
      </div>
    );
  }
);
