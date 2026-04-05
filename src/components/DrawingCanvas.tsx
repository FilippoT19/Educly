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
const COLORS_DARK  = ["#f0f0f0", "#f87171", "#60a5fa", "#4ade80", "#c084fc"];
const SIZES = [2, 4, 7, 12];
const CANVAS_HEIGHT = 3000;
const GRID_SIZE = 28;
const BG_LIGHT = "#ffffff";
const BG_DARK  = "#0d1526";
const GRID_LIGHT = "#e5e7eb";
const GRID_DARK  = "rgba(255,255,255,0.06)";
const STROKE_ERASE_RADIUS = 20;

type Tool = "pen" | "eraser" | "stroke-eraser";

// ── Pure helpers (no React) ────────────────────────────────────────────────

function svgPath(pts: number[][]): string {
  if (!pts.length) return "";
  const d = pts.reduce((acc, [x0, y0], i, arr) => {
    const [x1, y1] = arr[(i + 1) % arr.length];
    acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    return acc;
  }, ["M", ...pts[0], "Q"]);
  d.push("Z");
  return d.join(" ");
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, dark: boolean) {
  ctx.save();
  ctx.strokeStyle = dark ? GRID_DARK : GRID_LIGHT;
  ctx.lineWidth = 1 / dpr;
  for (let x = 0; x <= w; x += GRID_SIZE) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += GRID_SIZE) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.restore();
}

function paintStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const pts = getStroke(stroke.points, {
    size: stroke.size, thinning: stroke.isEraser ? 0 : 0.5,
    smoothing: 0.5, streamline: 0.5, simulatePressure: false,
  });
  const path = new Path2D(svgPath(pts));
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

function hitsPoint(stroke: Stroke, x: number, y: number, r: number) {
  for (const p of stroke.points) {
    if ((p.x - x) ** 2 + (p.y - y) ** 2 <= r * r) return true;
  }
  return false;
}

// ── Component ──────────────────────────────────────────────────────────────

export const DrawingCanvas = forwardRef<DrawingCanvasRef, { className?: string; fillHeight?: boolean }>(
  function DrawingCanvas({ className, fillHeight }, ref) {

    // Canvas layers:
    //  bgCanvas  — background + grid (never touched by eraser)
    //  baseCanvas — committed strokes (transparent bg, erasable)
    //  liveCanvas — receives all pointer events; shows current stroke preview
    const bgRef   = useRef<HTMLCanvasElement>(null);
    const baseRef = useRef<HTMLCanvasElement>(null);
    const liveRef = useRef<HTMLCanvasElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);

    // All drawing state lives in refs so native event handlers are never stale
    const strokes    = useRef<Stroke[]>([]);
    const current    = useRef<Point[]>([]);
    const drawing    = useRef(false);
    const pointerId  = useRef<number | null>(null);
    const dpr        = useRef(1);
    const W          = useRef(0);
    const lastErased = useRef<Set<number>>(new Set());

    // Tool/style refs (mirrored from state)
    const toolR  = useRef<Tool>("pen");
    const colorR = useRef(COLORS_LIGHT[0]);
    const sizeR  = useRef(SIZES[1]);
    const darkR  = useRef(false);

    const [tool, setTool]     = useState<Tool>("pen");
    const [dark, setDark]     = useState(false);
    const [color, setColor]   = useState(COLORS_LIGHT[0]);
    const [size, setSize]     = useState(SIZES[1]);
    const [empty, setEmpty]   = useState(true);

    useEffect(() => { toolR.current  = tool;  }, [tool]);
    useEffect(() => { colorR.current = color; }, [color]);
    useEffect(() => { sizeR.current  = size;  }, [size]);
    useEffect(() => { darkR.current  = dark;  }, [dark]);

    const COLORS = dark ? COLORS_DARK : COLORS_LIGHT;
    useEffect(() => { setColor(dark ? COLORS_DARK[0] : COLORS_LIGHT[0]); }, [dark]);

    // ── Redraw helpers ───────────────────────────────────────────────────────

    const redrawBg = useCallback(() => {
      const c = bgRef.current; if (!c) return;
      const ctx = c.getContext("2d"); if (!ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = darkR.current ? BG_DARK : BG_LIGHT;
      ctx.fillRect(0, 0, c.width, c.height);
      drawGrid(ctx, W.current, CANVAS_HEIGHT, dpr.current, darkR.current);
    }, []);

    const redrawBase = useCallback(() => {
      const c = baseRef.current; if (!c) return;
      const ctx = c.getContext("2d"); if (!ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      for (const s of strokes.current) paintStroke(ctx, s);
    }, []);

    const clearLive = useCallback(() => {
      const c = liveRef.current; if (!c) return;
      c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    }, []);

    // ── Resize ───────────────────────────────────────────────────────────────

    useEffect(() => {
      const wrap = wrapRef.current; if (!wrap) return;
      const ro = new ResizeObserver(() => {
        const { width } = wrap.getBoundingClientRect();
        const d = window.devicePixelRatio || 1;
        dpr.current = d;
        W.current = width;
        for (const c of [bgRef.current, baseRef.current, liveRef.current]) {
          if (!c) continue;
          c.width  = width * d;
          c.height = CANVAS_HEIGHT * d;
          c.style.width  = `${width}px`;
          c.style.height = `${CANVAS_HEIGHT}px`;
          c.getContext("2d")?.scale(d, d);
        }
        redrawBg();
        redrawBase();
      });
      ro.observe(wrap);
      return () => ro.disconnect();
    }, [redrawBg, redrawBase]);

    // Redraw bg when dark mode changes
    useEffect(() => {
      darkR.current = dark;
      redrawBg();
    }, [dark, redrawBg]);

    // ── Imperative API ───────────────────────────────────────────────────────

    useImperativeHandle(ref, () => ({
      exportPng: async () => {
        const bg   = bgRef.current;
        const base = baseRef.current;
        if (!bg || !base) return null;
        const last = strokes.current[strokes.current.length - 1];
        let maxY = 600;
        if (last) {
          maxY = Math.min(Math.max(...last.points.map(p => p.y)) + 120, CANVAS_HEIGHT);
        }
        const d = dpr.current;
        const out = document.createElement("canvas");
        out.width  = base.width;
        out.height = maxY * d;
        const ctx = out.getContext("2d")!;
        ctx.drawImage(bg,   0, 0, base.width, maxY * d, 0, 0, base.width, maxY * d);
        ctx.drawImage(base, 0, 0, base.width, maxY * d, 0, 0, base.width, maxY * d);
        return new Promise(res => out.toBlob(b => res(b), "image/png", 1.0));
      },
      clear: () => {
        strokes.current = [];
        current.current = [];
        setEmpty(true);
        redrawBase();
        clearLive();
      },
      isEmpty: () => empty,
    }));

    // ── Native pointer event listeners (passive:false = preventDefault works) ─

    useEffect(() => {
      const canvas = liveRef.current;
      if (!canvas) return;

      function pos(e: PointerEvent): Point {
        const r = canvas!.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top, pressure: e.pressure || 0.5 };
      }

      function eraseAt(p: Point) {
        const before = strokes.current.length;
        strokes.current = strokes.current.filter((s, i) => {
          if (lastErased.current.has(i)) return false;
          if (hitsPoint(s, p.x, p.y, STROKE_ERASE_RADIUS)) {
            lastErased.current.add(i);
            return false;
          }
          return true;
        });
        if (strokes.current.length !== before) {
          lastErased.current = new Set();
          redrawBase();
          if (strokes.current.length === 0) setEmpty(true);
        }
      }

      function onDown(e: PointerEvent) {
        if (e.pointerType === "touch") return;     // palm / finger → scroll
        if (pointerId.current !== null) return;    // already drawing
        e.preventDefault();
        canvas!.setPointerCapture(e.pointerId);
        pointerId.current = e.pointerId;
        drawing.current   = true;
        lastErased.current = new Set();
        if (toolR.current === "stroke-eraser") { eraseAt(pos(e)); return; }
        current.current = [pos(e)];
        setEmpty(false);
      }

      function onMove(e: PointerEvent) {
        if (!drawing.current || e.pointerId !== pointerId.current) return;
        e.preventDefault();
        const p = pos(e);
        if (toolR.current === "stroke-eraser") { eraseAt(p); return; }

        // Coalesced events for smoother input
        const events = (e.getCoalescedEvents?.() ?? [e]);
        const r = canvas!.getBoundingClientRect();
        for (const ev of events) {
          current.current.push({ x: ev.clientX - r.left, y: ev.clientY - r.top, pressure: ev.pressure || 0.5 });
        }

        const liveCtx = canvas!.getContext("2d")!;
        liveCtx.clearRect(0, 0, canvas!.width, canvas!.height);

        const pts = getStroke(current.current, {
          size: toolR.current === "eraser" ? sizeR.current * 3 : sizeR.current,
          thinning: toolR.current === "eraser" ? 0 : 0.5,
          smoothing: 0.5, streamline: 0.5, simulatePressure: false,
        });
        const path = new Path2D(svgPath(pts));

        if (toolR.current === "eraser") {
          // Circle cursor on live canvas
          liveCtx.save();
          liveCtx.strokeStyle = "rgba(150,150,150,0.6)";
          liveCtx.lineWidth = 1.5;
          liveCtx.beginPath();
          liveCtx.arc(p.x, p.y, sizeR.current * 1.5, 0, Math.PI * 2);
          liveCtx.stroke();
          liveCtx.restore();
          // Erase on base canvas (transparent bg → grid on bgCanvas is safe)
          const bCtx = baseRef.current?.getContext("2d");
          if (bCtx) {
            bCtx.save();
            bCtx.globalCompositeOperation = "destination-out";
            bCtx.fillStyle = "rgba(0,0,0,1)";
            bCtx.fill(path);
            bCtx.restore();
          }
        } else {
          liveCtx.fillStyle = colorR.current;
          liveCtx.fill(path);
        }
      }

      function onUp(e: PointerEvent) {
        if (!drawing.current || e.pointerId !== pointerId.current) return;
        e.preventDefault();
        drawing.current  = false;
        pointerId.current = null;

        if (toolR.current === "stroke-eraser") {
          lastErased.current = new Set();
          return;
        }
        if (toolR.current === "eraser") {
          strokes.current.push({ points: [...current.current], color: colorR.current, size: sizeR.current * 3, isEraser: true });
          current.current = [];
          clearLive();
          return;
        }
        if (current.current.length > 0) {
          const s: Stroke = { points: [...current.current], color: colorR.current, size: sizeR.current, isEraser: false };
          strokes.current.push(s);
          const bCtx = baseRef.current?.getContext("2d");
          if (bCtx) paintStroke(bCtx, s);
          current.current = [];
          clearLive();
        }
      }

      canvas.addEventListener("pointerdown",  onDown, { passive: false });
      canvas.addEventListener("pointermove",  onMove, { passive: false });
      canvas.addEventListener("pointerup",    onUp,   { passive: false });
      canvas.addEventListener("pointercancel", onUp,  { passive: false });
      return () => {
        canvas.removeEventListener("pointerdown",  onDown);
        canvas.removeEventListener("pointermove",  onMove);
        canvas.removeEventListener("pointerup",    onUp);
        canvas.removeEventListener("pointercancel", onUp);
      };
    }, [redrawBase, clearLive]);

    // ── Styles ───────────────────────────────────────────────────────────────

    const tb   = dark ? "bg-[#0a1020] border-white/10 text-gray-300" : "bg-gray-50 border-gray-200 text-gray-600";
    const act  = dark ? "bg-white/15 border-white/20 text-white border" : "bg-white shadow-sm border text-gray-800";
    const hov  = dark ? "hover:bg-white/10" : "hover:bg-gray-200";
    const div  = dark ? "bg-white/15" : "bg-gray-300";

    return (
      <div className={className} style={{ userSelect: "none", WebkitUserSelect: "none" }}>

        {/* Toolbar */}
        <div className={`flex items-center gap-2 px-3 py-2 border-b rounded-t-xl flex-wrap ${tb}`}
          style={{ userSelect: "none", WebkitUserSelect: "none" }}>

          <div className="flex gap-1">
            {([
              { id: "pen"           as Tool, icon: <Pen   className="h-4 w-4" />, title: "Penna" },
              { id: "eraser"        as Tool, icon: <Eraser className="h-4 w-4" />, title: "Gomma pixel" },
              { id: "stroke-eraser" as Tool, icon: <Minus  className="h-4 w-4" />, title: "Gomma tratto" },
            ] as const).map(({ id, icon, title }) => (
              <button key={id} onClick={() => setTool(id)} title={title}
                className={`p-1.5 rounded-md transition-colors ${tool === id ? act : hov}`}>
                {icon}
              </button>
            ))}
          </div>

          <div className={`h-4 w-px ${div}`} />

          {tool === "pen" && <>
            <div className="flex gap-1.5">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${color === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : ""}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className={`h-4 w-px ${div}`} />
          </>}

          <div className="flex gap-1.5 items-center">
            {SIZES.map(s => (
              <button key={s} onClick={() => setSize(s)}
                className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${size === s ? act : hov}`}>
                <div className="rounded-full" style={{
                  width:  Math.min(s * 2.5, 16),
                  height: Math.min(s * 2.5, 16),
                  backgroundColor: tool === "pen" ? color : (dark ? "#888" : "#666"),
                }} />
              </button>
            ))}
          </div>

          <div className={`h-4 w-px ${div} ml-auto`} />

          <button onClick={() => setDark(d => !d)} title={dark ? "Sfondo chiaro" : "Sfondo scuro"}
            className={`p-1.5 rounded-md transition-colors ${dark ? act : hov}`}>
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          <div className={`h-4 w-px ${div}`} />

          <button
            onClick={() => { strokes.current = []; setEmpty(true); redrawBase(); clearLive(); }}
            className={`flex items-center gap-1 text-xs p-1.5 rounded-md transition-colors hover:text-red-500 ${hov}`}
            title="Cancella tutto"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cancella</span>
          </button>
        </div>

        {/* Canvas stack */}
        <div ref={wrapRef} className="relative overflow-y-auto rounded-b-xl"
          style={{ height: fillHeight ? "100%" : "500px", touchAction: "pan-y",
            userSelect: "none", WebkitUserSelect: "none" }}>

          {/* bg layer — grid never erased */}
          <canvas ref={bgRef}   style={{ display: "block", position: "absolute", top: 0, left: 0, touchAction: "none" }} />
          {/* base layer — strokes, transparent bg */}
          <canvas ref={baseRef} style={{ display: "block", position: "absolute", top: 0, left: 0, touchAction: "none" }} />
          {/* live layer — pointer events here */}
          <canvas ref={liveRef} style={{
            display: "block", position: "absolute", top: 0, left: 0, touchAction: "none",
            cursor: tool === "pen" ? "crosshair" : tool === "eraser" ? "cell" : "default",
          }} />

          {/* scroll spacer */}
          <div style={{ height: CANVAS_HEIGHT, width: "100%", pointerEvents: "none" }} />
        </div>

        <p className={`text-xs text-center mt-1.5 ${dark ? "text-gray-500" : "text-muted-foreground"}`}>
          Pencil per scrivere · Dito per scorrere
        </p>
      </div>
    );
  }
);
