"use client";

import { RefObject } from "react";

interface MathKeyboardProps {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
}

const BUTTONS: { label: string; insert: string; moveCursorBack: number }[] = [
  { label: "π",     insert: "pi",        moveCursorBack: 0 },
  { label: "∞",     insert: "inf",       moveCursorBack: 0 },
  { label: "√",     insert: "sqrt()",    moveCursorBack: 1 },
  { label: "x²",    insert: "^2",        moveCursorBack: 0 },
  { label: "xⁿ",    insert: "^()",       moveCursorBack: 1 },
  { label: "a/b",   insert: "()/() ",    moveCursorBack: 6 },
  { label: "sin",   insert: "sin()",     moveCursorBack: 1 },
  { label: "cos",   insert: "cos()",     moveCursorBack: 1 },
  { label: "tan",   insert: "tan()",     moveCursorBack: 1 },
  { label: "arcsin",insert: "arcsin()",  moveCursorBack: 1 },
  { label: "arccos",insert: "arccos()",  moveCursorBack: 1 },
  { label: "|x|",   insert: "abs()",     moveCursorBack: 1 },
  { label: "eˣ",    insert: "e^()",      moveCursorBack: 1 },
  { label: "ln",    insert: "ln()",      moveCursorBack: 1 },
  { label: "log",   insert: "log()",     moveCursorBack: 1 },
  { label: "∫",     insert: "integral()",moveCursorBack: 1 },
  { label: "lim",   insert: "lim_{} ",   moveCursorBack: 2 },
];

export function MathKeyboard({ inputRef, value, onChange }: MathKeyboardProps) {
  function handleInsert(insert: string, moveCursorBack: number) {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;

    const newValue = value.substring(0, start) + insert + value.substring(end);
    onChange(newValue);

    const newPos = start + insert.length - moveCursorBack;
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(newPos, newPos);
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5 py-2">
      {BUTTONS.map(({ label, insert, moveCursorBack }) => (
        <button
          key={label}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault(); // don't steal focus from input
            handleInsert(insert, moveCursorBack);
          }}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-muted/60 hover:bg-muted px-2.5 py-1.5 text-xs font-mono font-medium transition-colors select-none"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
