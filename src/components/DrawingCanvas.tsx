"use client";

import {
  useRef, useState, useEffect, useCallback,
  useImperativeHandle, forwardRef,
} from "react";
import { getStroke } from "perfect-freehand";
import { Eraser, Pen, Trash2, Moon, Sun, Minus } from "lucide-react";

interface Point { x: number; y: number; pressure: number }
interface Stroke { points: Point[]; color: string; size: number; isEraser: boolean }

export interface DrawingCanvasRef {
  exportPng: () => Promise<Blob | null>;
  clear: () => void;
  isEmpty: () => boolean;
}

const COLORS_LIGHT = ["#1a1a1a", "#e53e3e", "#2563eb", "#16a34a", "#9333ea"];
const COLORS_DARK  = ["#ffffff", "#f87171", "#60a5fa", "#4ade80", "#c084fc"];
const SIZES = [2, 4, 7, 12];
const CANVAS_HEIGHT = 2400;
const GRID_SIZE = 28;
const BG_LIGHT = "#ffffff";
const BG_DARK  = "#0d1526";
const GRID_LIGHT = "#e5e7eb";
const GRID_DARK  = "rgba(255,255,255,0.06)";

// Distance threshold for stroke-eraser hit detection (logical px)
const STROKE_ERASE_RADIUS = 18;

function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );
  d.push("Z");
  return d.join(" ");
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, dark: boolean) {
  ctx.save();
  ctx.strokeStyle = dark ? GRID_DARK : GRID_LIGHT;
  ctx.lineWidth = 1 / dpr;
  for (let x = 0; x <= w; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.restore();
}

function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const pts = getStroke(stroke.points, {
    size: stroke.size,
    thinning: stroke.isEraser ? 0 : 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,
  });
  const path = new Path2D(getSvgPathFromStroke(pts));
  if (stroke.isEraser) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fill(path);
    ctx.restore();
  } else {
    ctx.fillStyle = stroke.color;
    ctx.fill(path);
  }
}

// Returns true if any point in the stroke is within radius px of (px, py)
function strokeHitsPoint(stroke: Stroke, px: number, py: number, radius: number): boolean {
  for (const p of stroke.points) {
    const dx = p.x - px, dy = p.y - py;
    if (dx * dx + dy * dy <= radius * radius) return true;
  }
  return false;
}

type Tool = "pen" | "eraser" | "stroke-eraser";

export const DrawingCanvas = forwardRef<DrawingCanvasRef, { className?: string; fillHeight?: boolean }>(
  function DrawingCanvas({ className, fillHeight }, ref) {
    // Three canvas layers:
    // bgCanvas    → background color + grid (never erased)
    // baseCanvas  → committed strokes only, transparent bg (erasable)
    // liveCanvas  → current stroke being drawn (transparent bg, cleared on commit)
    const bgCanvasRef   = useRef<HTMLCanvasElement>(null);
    const baseCanvasRef = useRef<HTMLCanvasElement>(null);
    const liveCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef  = useRef<HTMLDivElement>(null);

    const strokesRef       = useRef<Stroke[]>([]);
    const currentStrokeRef = useRef<Point[]>([]);
    const isDrawingRef     = useRef(false);
    const dprRef           = useRef(1);
    const wRef             = useRef(0);
    const lastErasedRef    = useRef<Set<number>>(new Set()); // indices erased in current stroke-erase gesture

    const [tool, setTool]         = useState<Tool>("pen");
    const [darkCanvas, setDark]   = useState(false);
    const [color, setColor]       = useState(COLORS_LIGHT[0]);
    const [size, setSize]         = useState(SIZES[1]);
    const [isEmpty, setIsEmpty]   = useState(true);

    const COLORS = darkCanvas ? COLORS_DARK : COLORS_LIGHT;
    useEffect(() => { setColor(darkCanvas ? COLORS_DARK[0] : COLORS_LIGHT[0]); }, [darkCanvas]);

    // ── Redraw background canvas (grid only, never erased) ───────────────────
    const redrawBg = useCallback(() => {
      const canvas = bgCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = dprRef.current;
      const w = wRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = darkCanvas ? BG_DARK : BG_LIGHT;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawGrid(ctx, w, CANVAS_HEIGHT, dpr, darkCanvas);
    }, [darkCanvas]);

    // ── Redraw base canvas (committed strokes, transparent bg) ───────────────
    const redrawBase = useCallback(() => {
      const canvas = baseCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Transparent clear — background comes from bgCanvas below
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of strokesRef.current) renderStroke(ctx, s);
    }, []);

    useEffect(() => { redrawBg(); redrawBase(); }, [darkCanvas, redrawBg, redrawBase]);

    // ── Clear live canvas ─────────────────────────────────────────────────────
    function clearLive() {
      const c = liveCanvasRef.current;
      if (!c) return;
      c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    }

    // ── Canvas sizing ──────────────────────────────────────────────────────────
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const observer = new ResizeObserver(() => {
        const { width } = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        dprRef.current = dpr;
        wRef.current = width;
        for (const canvas of [bgCanvasRef.current, baseCanvasRef.current, liveCanvasRef.current]) {
          if (!canvas) continue;
          canvas.width = width * dpr;
          canvas.height = CANVAS_HEIGHT * dpr;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${CANVAS_HEIGHT}px`;
          canvas.getContext("2d")?.scale(dpr, dpr);
        }
        redrawBg();
        redrawBase();
      });
      observer.observe(container);
      return () => observer.disconnect();
    }, [redrawBg, redrawBase]);

    // ── Imperative handle ──────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      exportPng: async () => {
        const bg = bgCanvasRef.current;
        const base = baseCanvasRef.current;
        if (!bg || !base) return null;
        const lastStroke = strokesRef.current[strokesRef.current.length - 1];
        let maxY = 600;
        if (lastStroke) {
          const ys = lastStroke.points.map((p) => p.y);
          maxY = Math.min(Math.max(...ys) + 100, CANVAS_HEIGHT);
        }
        const dpr = dprRef.current;
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = base.width;
        exportCanvas.height = maxY * dpr;
        const ctx = exportCanvas.getContext("2d");
        if (!ctx) return null;
        // Composite bg + strokes
        ctx.drawImage(bg,   0, 0, base.width, maxY * dpr, 0, 0, base.width, maxY * dpr);
        ctx.drawImage(base, 0, 0, base.width, maxY * dpr, 0, 0, base.width, maxY * dpr);
        return new Promise((resolve) => exportCanvas.toBlob((b) => resolve(b), "image/png", 1.0));
      },
      clear: () => {
        strokesRef.current = [];
        currentStrokeRef.current = [];
        setIsEmpty(true);
        redrawBase();
        clearLive();
      },
      isEmpty: () => isEmpty,
    }));

    // ── Pointer helpers ────────────────────────────────────────────────────────
    function getPos(e: PointerEvent, canvas: HTMLCanvasElement): Point {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure || 0.5 };
    }

    function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
      // Accept pen (stylus) and mouse; reject touch (palm / finger scroll)
      if (e.pointerType === "touch") return;
      e.preventDefault();
      liveCanvasRef.current?.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;
      lastErasedRef.current = new Set();

      if (tool === "stroke-eraser") {
        // Immediately test & erase on down
        eraseStrokesAt(getPos(e.nativeEvent, liveCanvasRef.current!));
        return;
      }

      currentStrokeRef.current = [getPos(e.nativeEvent, liveCanvasRef.current!)];
      setIsEmpty(false);
    }

    function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!isDrawingRef.current) return;
      e.preventDefault();

      const canvas = liveCanvasRef.current!;
      const pos = getPos(e.nativeEvent, canvas);

      if (tool === "stroke-eraser") {
        eraseStrokesAt(pos);
        return;
      }

      const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
      for (const ev of events) currentStrokeRef.current.push(getPos(ev, canvas));

      // Draw only the current stroke on the live canvas
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const pts = getStroke(currentStrokeRef.current, {
        size: tool === "eraser" ? size * 3 : size,
        thinning: tool === "eraser" ? 0 : 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: false,
      });
      const path = new Path2D(getSvgPathFromStroke(pts));
      if (tool === "eraser") {
        // Show eraser position as a semi-transparent circle (for feedback)
        ctx.save();
        ctx.strokeStyle = "rgba(150,150,150,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        // Apply eraser to base canvas directly
        const baseCtx = baseCanvasRef.current?.getContext("2d");
        if (baseCtx) {
          baseCtx.save();
          baseCtx.globalCompositeOperation = "destination-out";
          baseCtx.fillStyle = "rgba(0,0,0,1)";
          baseCtx.fill(path);
          baseCtx.restore();
        }
      } else {
        ctx.fillStyle = color;
        ctx.fill(path);
      }
    }

    function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      isDrawingRef.current = false;

      if (tool === "stroke-eraser") {
        lastErasedRef.current = new Set();
        return;
      }

      if (tool === "eraser") {
        // Commit eraser stroke to base (already applied pixel by pixel in move)
        // Just need to save a record of the stroke for potential undo (future)
        strokesRef.current.push({
          points: [...currentStrokeRef.current],
          color,
          size: size * 3,
          isEraser: true,
        });
        currentStrokeRef.current = [];
        clearLive();
        return;
      }

      if (currentStrokeRef.current.length > 0) {
        const newStroke: Stroke = {
          points: [...currentStrokeRef.current],
          color,
          size,
          isEraser: false,
        };
        strokesRef.current.push(newStroke);
        // Paint the committed stroke onto base canvas
        const baseCtx = baseCanvasRef.current?.getContext("2d");
        if (baseCtx) renderStroke(baseCtx, newStroke);
        currentStrokeRef.current = [];
        clearLive();
      }
    }

    function eraseStrokesAt(pos: Point) {
      const before = strokesRef.current.length;
      strokesRef.current = strokesRef.current.filter((s, i) => {
        if (lastErasedRef.current.has(i)) return false; // already erased this gesture
        if (strokeHitsPoint(s, pos.x, pos.y, STROKE_ERASE_RADIUS)) {
          lastErasedRef.current.add(i);
          return false;
        }
        return true;
      });
      // Re-index lastErasedRef after filter (just clear it, re-built per gesture)
      if (strokesRef.current.length !== before) {
        lastErasedRef.current = new Set();
        redrawBase();
        if (strokesRef.current.length === 0) setIsEmpty(true);
      }
    }

    // ── Styling ────────────────────────────────────────────────────────────────
    const tb = darkCanvas ? "bg-[#0a1020] border-white/10 text-gray-300" : "bg-gray-50 border-gray-200 text-gray-600";
    const btnActive = darkCanvas ? "bg-white/15 border-white/20 text-white border" : "bg-white shadow-sm border text-gray-800";
    const btnHover  = darkCanvas ? "hover:bg-white/10" : "hover:bg-gray-200";
    const divider   = darkCanvas ? "bg-white/15" : "bg-gray-300";

    return (
      <div className={className} style={{ userSelect: "none", WebkitUserSelect: "none" }}>
        {/* Toolbar */}
        <div className={`flex items-center gap-2 px-3 py-2 border-b rounded-t-xl flex-wrap ${tb}`}
          style={{ userSelect: "none", WebkitUserSelect: "none" }}>

          {/* Tools */}
          <div className="flex gap-1">
            {([
              { id: "pen" as Tool, icon: <Pen className="h-4 w-4" />, title: "Penna" },
              { id: "eraser" as Tool, icon: <Eraser className="h-4 w-4" />, title: "Gomma pixel" },
              { id: "stroke-eraser" as Tool, icon: <Minus className="h-4 w-4" />, title: "Gomma tratto" },
            ] as const).map(({ id, icon, title }) => (
              <button key={id} onClick={() => setTool(id)} title={title}
                className={`p-1.5 rounded-md transition-colors ${tool === id ? btnActive : btnHover}`}>
                {icon}
              </button>
            ))}
          </div>

          <div className={`h-4 w-px ${divider}`} />

          {/* Colors (pen only) */}
          {tool === "pen" && <>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${color === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : ""}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className={`h-4 w-px ${divider}`} />
          </>}

          {/* Size */}
          <div className="flex gap-1.5 items-center">
            {SIZES.map((s) => (
              <button key={s} onClick={() => setSize(s)}
                className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${size === s ? btnActive : btnHover}`}>
                <div className="rounded-full" style={{
                  width: Math.min(s * 2.5, 16),
                  height: Math.min(s * 2.5, 16),
                  backgroundColor: tool === "pen" ? color : (darkCanvas ? "#888" : "#666"),
                }} />
              </button>
            ))}
          </div>

          <div className={`h-4 w-px ${divider} ml-auto`} />

          {/* Dark mode */}
          <button onClick={() => setDark(!darkCanvas)} title={darkCanvas ? "Sfondo chiaro" : "Sfondo scuro"}
            className={`p-1.5 rounded-md transition-colors ${darkCanvas ? btnActive : btnHover}`}>
            {darkCanvas ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          <div className={`h-4 w-px ${divider}`} />

          {/* Clear */}
          <button
            onClick={() => { strokesRef.current = []; setIsEmpty(true); redrawBase(); clearLive(); }}
            className={`flex items-center gap-1 text-xs p-1.5 rounded-md transition-colors hover:text-red-500 ${btnHover}`}
            title="Cancella tutto"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cancella</span>
          </button>
        </div>

        {/* Canvas stack */}
        <div ref={containerRef}
          className="relative overflow-y-auto rounded-b-xl"
          style={{
            height: fillHeight ? "100%" : "420px",
            touchAction: "pan-y",
            backgroundColor: darkCanvas ? BG_DARK : BG_LIGHT,
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          {/* Background layer — grid + bg color, never erased */}
          <canvas ref={bgCanvasRef} style={{ display: "block", position: "absolute", top: 0, left: 0, touchAction: "none" }} />

          {/* Base layer — committed strokes (transparent bg) */}
          <canvas ref={baseCanvasRef} style={{ display: "block", position: "absolute", top: 0, left: 0, touchAction: "none" }} />

          {/* Live layer — current stroke */}
          <canvas
            ref={liveCanvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            style={{
              display: "block",
              position: "absolute",
              top: 0,
              left: 0,
              touchAction: "none",
              cursor: tool === "pen" ? "crosshair" : tool === "eraser" ? "cell" : "default",
            }}
          />
          {/* Spacer to give the container scrollable height */}
          <div style={{ height: CANVAS_HEIGHT, width: "100%", pointerEvents: "none" }} />
        </div>

        <p className={`text-xs text-center mt-1.5 ${darkCanvas ? "text-gray-500" : "text-muted-foreground"}`}>
          Pencil per scrivere · Dito per scorrere · Gomma tratto: tocca la linea per cancellarla
        </p>
      </div>
    );
  }
);
