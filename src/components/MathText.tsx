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

      // Convert newlines to <br>
      processed = processed.replace(/\n/g, "<br/>");

      containerRef.current!.innerHTML = processed;
    }

    render();
  }, [text]);

  return <div ref={containerRef} className={className} />;
}
