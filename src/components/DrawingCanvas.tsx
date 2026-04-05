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

    // Persistent drawing state — all in refs so native event handlers never go stale
    const strokesRef       = useRef<Stroke[]>([]);
    const currentStrokeRef = useRef<Point[]>([]);
    const isDrawingRef     = useRef(false);
    const activePointerRef = useRef<number | null>(null); // prevents ghost pointerup from prev stroke
    const dprRef           = useRef(1);
    const wRef             = useRef(0);
    const lastErasedRef    = useRef<Set<number>>(new Set());

    // Mirror state → refs so native event handlers always read the latest value
    const toolRef  = useRef<Tool>("pen");
    const colorRef = useRef(COLORS_LIGHT[0]);
    const sizeRef  = useRef(SIZES[1]);
    const darkRef  = useRef(false);

    const [tool, setTool]       = useState<Tool>("pen");
    const [darkCanvas, setDark] = useState(false);
    const [color, setColor]     = useState(COLORS_LIGHT[0]);
    const [size, setSize]       = useState(SIZES[1]);
    const [isEmpty, setIsEmpty] = useState(true);

    useEffect(() => { toolRef.current = tool; }, [tool]);
    useEffect(() => { colorRef.current = color; }, [color]);
    useEffect(() => { sizeRef.current = size; }, [size]);

    const COLORS = darkCanvas ? COLORS_DARK : COLORS_LIGHT;
    useEffect(() => { setColor(darkCanvas ? COLORS_DARK[0] : COLORS_LIGHT[0]); }, [darkCanvas]);

    // ── Background canvas (grid + fill, never touched by eraser) ─────────────
    const redrawBg = useCallback(() => {
      const canvas = bgCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = darkRef.current ? BG_DARK : BG_LIGHT;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawGrid(ctx, wRef.current, CANVAS_HEIGHT, dprRef.current, darkRef.current);
    }, []);

    // Update dark ref then redraw bg when dark mode changes
    useEffect(() => {
      darkRef.current = darkCanvas;
      redrawBg();
    }, [darkCanvas, redrawBg]);

    // ── Base canvas (committed strokes, transparent bg) ───────────────────────
    const redrawBase = useCallback(() => {
      const canvas = baseCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of strokesRef.current) renderStroke(ctx, s);
    }, []);

    // ── Clear live canvas ─────────────────────────────────────────────────────
    const clearLive = useCallback(() => {
      const c = liveCanvasRef.current;
      if (!c) return;
      c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    }, []);

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

    // ── Native pointer event listeners ─────────────────────────────────────────
    // Native (not React synthetic) so we can pass { passive: false } and ensure
    // preventDefault works. All state read from refs — no stale closures.
    useEffect(() => {
      const canvas = liveCanvasRef.current;
      if (!canvas) return;

      function getPos(e: PointerEvent): Point {
        const rect = canvas!.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure || 0.5 };
      }

      function eraseStrokesAt(pos: Point) {
        const before = strokesRef.current.length;
        strokesRef.current = strokesRef.current.filter((s, i) => {
          if (lastErasedRef.current.has(i)) return false;
          if (strokeHitsPoint(s, pos.x, pos.y, STROKE_ERASE_RADIUS)) {
            lastErasedRef.current.add(i);
            return false;
          }
          return true;
        });
        if (strokesRef.current.length !== before) {
          lastErasedRef.current = new Set();
          redrawBase();
          if (strokesRef.current.length === 0) setIsEmpty(true);
        }
      }

      function handleDown(e: PointerEvent) {
        if (e.pointerType === "touch") return;
        if (activePointerRef.current !== null) return; // already drawing, ignore new pointer
        e.preventDefault();
        e.stopPropagation();
        canvas!.setPointerCapture(e.pointerId);
        activePointerRef.current = e.pointerId;
        isDrawingRef.current = true;
        lastErasedRef.current = new Set();

        if (toolRef.current === "stroke-eraser") {
          eraseStrokesAt(getPos(e));
          return;
        }
        currentStrokeRef.current = [getPos(e)];
        setIsEmpty(false);
      }

      function handleMove(e: PointerEvent) {
        if (!isDrawingRef.current || e.pointerId !== activePointerRef.current) return;
        e.preventDefault();

        const pos = getPos(e);

        if (toolRef.current === "stroke-eraser") {
          eraseStrokesAt(pos);
          return;
        }

        const events = e.getCoalescedEvents?.() ?? [e];
        const rect = canvas!.getBoundingClientRect();
        for (const ev of events) {
          currentStrokeRef.current.push({
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top,
            pressure: ev.pressure || 0.5,
          });
        }

        const liveCtx = canvas!.getContext("2d");
        if (!liveCtx) return;
        liveCtx.clearRect(0, 0, canvas!.width, canvas!.height);

        const pts = getStroke(currentStrokeRef.current, {
          size: toolRef.current === "eraser" ? sizeRef.current * 3 : sizeRef.current,
          thinning: toolRef.current === "eraser" ? 0 : 0.5,
          smoothing: 0.5,
          streamline: 0.5,
          simulatePressure: false,
        });
        const path = new Path2D(getSvgPathFromStroke(pts));

        if (toolRef.current === "eraser") {
          // Circle cursor feedback on live canvas
          liveCtx.save();
          liveCtx.strokeStyle = "rgba(150,150,150,0.5)";
          liveCtx.lineWidth = 1;
          liveCtx.beginPath();
          liveCtx.arc(pos.x, pos.y, sizeRef.current * 1.5, 0, Math.PI * 2);
          liveCtx.stroke();
          liveCtx.restore();
          // Apply erase to base canvas (transparent — won't touch bgCanvas grid)
          const baseCtx = baseCanvasRef.current?.getContext("2d");
          if (baseCtx) {
            baseCtx.save();
            baseCtx.globalCompositeOperation = "destination-out";
            baseCtx.fillStyle = "rgba(0,0,0,1)";
            baseCtx.fill(path);
            baseCtx.restore();
          }
        } else {
          liveCtx.fillStyle = colorRef.current;
          liveCtx.fill(path);
        }
      }

      function handleUp(e: PointerEvent) {
        if (!isDrawingRef.current || e.pointerId !== activePointerRef.current) return;
        e.preventDefault();
        isDrawingRef.current = false;
        activePointerRef.current = null;

        if (toolRef.current === "stroke-eraser") {
          lastErasedRef.current = new Set();
          return;
        }

        if (toolRef.current === "eraser") {
          strokesRef.current.push({
            points: [...currentStrokeRef.current],
            color: colorRef.current,
            size: sizeRef.current * 3,
            isEraser: true,
          });
          currentStrokeRef.current = [];
          clearLive();
          return;
        }

        if (currentStrokeRef.current.length > 0) {
          const newStroke: Stroke = {
            points: [...currentStrokeRef.current],
            color: colorRef.current,
            size: sizeRef.current,
            isEraser: false,
          };
          strokesRef.current.push(newStroke);
          const baseCtx = baseCanvasRef.current?.getContext("2d");
          if (baseCtx) renderStroke(baseCtx, newStroke);
          currentStrokeRef.current = [];
          clearLive();
        }
      }

      canvas.addEventListener("pointerdown", handleDown, { passive: false });
      canvas.addEventListener("pointermove", handleMove, { passive: false });
      canvas.addEventListener("pointerup",   handleUp,   { passive: false });
      canvas.addEventListener("pointercancel", handleUp, { passive: false });

      return () => {
        canvas.removeEventListener("pointerdown", handleDown);
        canvas.removeEventListener("pointermove", handleMove);
        canvas.removeEventListener("pointerup",   handleUp);
        canvas.removeEventListener("pointercancel", handleUp);
      };
    }, [redrawBase, clearLive]); // stable deps — all state read via refs

    // ── Styling ────────────────────────────────────────────────────────────────
    const tb = darkCanvas ? "bg-[#0a1020] border-white/10 text-gray-300" : "bg-gray-50 border-gray-200 text-gray-600";
    const btnActive = darkCanvas ? "bg-white/15 border-white/20 text-white border" : "bg-white shadow-sm border text-gray-800";
    const btnHover  = darkCanvas ? "hover:bg-white/10" : "hover:bg-gray-200";
    const divider   = darkCanvas ? "bg-white/15" : "bg-gray-300";

    return (
      <div className={className} style={{ userSelect: "none", WebkitUserSelect: "none" }}>
        {/* Toolbar */}
        <div
          className={`flex items-center gap-2 px-3 py-2 border-b rounded-t-xl flex-wrap ${tb}`}
          style={{ userSelect: "none", WebkitUserSelect: "none" }}
        >
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
        <div
          ref={containerRef}
          className="relative overflow-y-auto rounded-b-xl"
          style={{
            height: fillHeight ? "100%" : "420px",
            touchAction: "pan-y",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          {/* Background layer — grid + bg color, never erased */}
          <canvas
            ref={bgCanvasRef}
            style={{ display: "block", position: "absolute", top: 0, left: 0, touchAction: "none" }}
          />

          {/* Base layer — committed strokes (transparent bg) */}
          <canvas
            ref={baseCanvasRef}
            style={{ display: "block", position: "absolute", top: 0, left: 0, touchAction: "none" }}
          />

          {/* Live layer — current stroke + receives all pointer events */}
          <canvas
            ref={liveCanvasRef}
            style={{
              display: "block",
              position: "absolute",
              top: 0,
              left: 0,
              touchAction: "none",
              cursor: tool === "pen" ? "crosshair" : tool === "eraser" ? "cell" : "default",
            }}
          />

          {/* Spacer for scrollable height */}
          <div style={{ height: CANVAS_HEIGHT, width: "100%", pointerEvents: "none" }} />
        </div>

        <p className={`text-xs text-center mt-1.5 ${darkCanvas ? "text-gray-500" : "text-muted-foreground"}`}>
          Pencil per scrivere · Dito per scorrere · Gomma tratto: tocca la linea per cancellarla
        </p>
      </div>
    );
  }
);
