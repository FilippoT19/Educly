"use client";

import { useEffect, useRef } from "react";

interface MathTextProps {
  text: string;
  className?: string;
}

// Renders text with LaTeX formulas using KaTeX
export function MathText({ text, className }: MathTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    async function render() {
      const katex = (await import("katex")).default;
      await import("katex/dist/katex.min.css");

      if (!containerRef.current) return;

      // Process display math $$...$$
      let processed = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, formula) => {
        try {
          return katex.renderToString(formula, { displayMode: true, throwOnError: false });
        } catch {
          return `<span class="text-destructive">$$${formula}$$</span>`;
        }
      });

      // Process inline math $...$
      processed = processed.replace(/\$([^$\n]+?)\$/g, (_, formula) => {
        try {
          return katex.renderToString(formula, { displayMode: false, throwOnError: false });
        } catch {
          return `<span class="text-destructive">$${formula}$</span>`;
        }
      });

      // Strip LaTeX text formatting commands (outside math mode)
      processed = processed
        .replace(/\\textbf\{([^}]*)\}/g, "<strong>$1</strong>")
        .replace(/\\textit\{([^}]*)\}/g, "<em>$1</em>")
        .replace(/\\underline\{([^}]*)\}/g, "<u>$1</u>")
        .replace(/\\text\{([^}]*)\}/g, "$1")
        .replace(/\\emph\{([^}]*)\}/g, "<em>$1</em>")
        .replace(/\\noindent\b/g, "")
        .replace(/\\medskip\b/g, "")
        .replace(/\\bigskip\b/g, "")
        .replace(/\\smallskip\b/g, "")
        .replace(/\\vspace\{[^}]*\}/g, "")
        .replace(/\\hspace\{[^}]*\}/g, "")
        .replace(/\\item\b/g, "• ")
        .replace(/\\begin\{(itemize|enumerate|list)[^}]*\}/g, "")
        .replace(/\\end\{(itemize|enumerate|list)[^}]*\}/g, "");

      // Strip markdown formatting from AI responses
      processed = processed
        .replace(/^#{1,6}\s+(.+)$/gm, "<strong>$1</strong>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/^[-*]\s+/gm, "• ");

      // Convert markdown images ![alt](url) to <img>
      processed = processed.replace(
        /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
        (_, alt, url) =>
          `<img src="${url}" alt="${alt}" style="max-width:100%;border-radius:8px;margin:8px 0;" />`
      );

      // Convert newlines to <br>
      processed = processed.replace(/\n/g, "<br/>");

      containerRef.current!.innerHTML = processed;
    }

    render();
  }, [text]);

  return <div ref={containerRef} className={className} />;
}
