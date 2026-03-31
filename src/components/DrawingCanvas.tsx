"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { getStroke } from "perfect-freehand";
import { Eraser, Pen, Trash2 } from "lucide-react";

interface Point {
  x: number;
  y: number;
  pressure: number;
}

interface Stroke {
  points: Point[];
  color: string;
  size: number;
  isEraser: boolean;
}

export interface DrawingCanvasRef {
  exportPng: () => Promise<Blob | null>;
  clear: () => void;
  isEmpty: () => boolean;
}

const COLORS = ["#1a1a1a", "#e53e3e", "#2563eb", "#16a34a", "#9333ea"];
const SIZES = [2, 4, 7, 12];
const CANVAS_HEIGHT = 2400; // long enough for most exercises
const GRID_SIZE = 28;

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

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) {
  ctx.save();
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1 / dpr;

  const step = GRID_SIZE;
  for (let x = 0; x <= width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, { className?: string }>(
  function DrawingCanvas({ className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const strokesRef = useRef<Stroke[]>([]);
    const currentStrokeRef = useRef<Point[]>([]);
    const isDrawingRef = useRef(false);
    const dprRef = useRef(1);
    const canvasWidthRef = useRef(0);

    const [tool, setTool] = useState<"pen" | "eraser">("pen");
    const [color, setColor] = useState(COLORS[0]);
    const [size, setSize] = useState(SIZES[1]);
    const [isEmpty, setIsEmpty] = useState(true);

    useImperativeHandle(ref, () => ({
      exportPng: async () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        // Export only the portion with content + some padding
        const lastStroke = strokesRef.current[strokesRef.current.length - 1];
        let maxY = 600; // minimum export height
        if (lastStroke) {
          const ys = lastStroke.points.map((p) => p.y);
          maxY = Math.min(Math.max(...ys) + 100, CANVAS_HEIGHT);
        }
        const dpr = dprRef.current;
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = canvas.width;
        exportCanvas.height = maxY * dpr;
        const ctx = exportCanvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(canvas, 0, 0, canvas.width, maxY * dpr, 0, 0, canvas.width, maxY * dpr);
        return new Promise((resolve) =>
          exportCanvas.toBlob((b) => resolve(b), "image/png", 1.0)
        );
      },
      clear: () => {
        strokesRef.current = [];
        currentStrokeRef.current = [];
        setIsEmpty(true);
        redraw();
      },
      isEmpty: () => isEmpty,
    }));

    const redraw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = dprRef.current;
      const w = canvasWidthRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawGrid(ctx, w, CANVAS_HEIGHT, dpr);

      for (const stroke of strokesRef.current) {
        const outlinePoints = getStroke(stroke.points, {
          size: stroke.size,
          thinning: stroke.isEraser ? 0 : 0.5,
          smoothing: 0.5,
          streamline: 0.5,
          simulatePressure: false,
        });
        const path = new Path2D(getSvgPathFromStroke(outlinePoints));
        if (stroke.isEraser) {
          ctx.save();
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = "rgba(0,0,0,1)";
          ctx.fill(path);
          ctx.restore();
          // Redraw grid over erased area
          ctx.save();
          ctx.globalCompositeOperation = "source-over";
          // We let the grid show through — no need to redraw, grid is always base
          ctx.restore();
        } else {
          ctx.fillStyle = stroke.color;
          ctx.fill(path);
        }
      }
    }, []);

    // Init canvas size
    useEffect(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const observer = new ResizeObserver(() => {
        const { width } = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        dprRef.current = dpr;
        canvasWidthRef.current = width;
        canvas.width = width * dpr;
        canvas.height = CANVAS_HEIGHT * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${CANVAS_HEIGHT}px`;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(dpr, dpr);
        redraw();
      });

      observer.observe(container);
      return () => observer.disconnect();
    }, [redraw]);

    function getPos(e: PointerEvent): Point {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure: e.pressure || 0.5,
      };
    }

    function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
      if (e.pointerType === "touch") return; // palm rejection
      e.preventDefault();
      canvasRef.current?.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;
      currentStrokeRef.current = [getPos(e.nativeEvent)];
      setIsEmpty(false);
    }

    function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!isDrawingRef.current) return;
      e.preventDefault();

      const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
      for (const ev of events) {
        currentStrokeRef.current.push(getPos(ev));
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      redraw();

      // Draw in-progress stroke
      const outlinePoints = getStroke(currentStrokeRef.current, {
        size: tool === "eraser" ? size * 3 : size,
        thinning: tool === "eraser" ? 0 : 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: false,
      });
      const path = new Path2D(getSvgPathFromStroke(outlinePoints));
      if (tool === "eraser") {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0,0,0,1)";
        ctx.fill(path);
        ctx.restore();
      } else {
        ctx.fillStyle = color;
        ctx.fill(path);
      }
    }

    function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      isDrawingRef.current = false;

      if (currentStrokeRef.current.length > 0) {
        strokesRef.current.push({
          points: [...currentStrokeRef.current],
          color,
          size: tool === "eraser" ? size * 3 : size,
          isEraser: tool === "eraser",
        });
        currentStrokeRef.current = [];
        redraw();
      }
    }

    return (
      <div className={className}>
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-3 py-2 border-b bg-gray-50 rounded-t-xl flex-wrap">
          {/* Pen / Eraser */}
          <div className="flex gap-1">
            <button
              onClick={() => setTool("pen")}
              className={`p-1.5 rounded-md transition-colors ${tool === "pen" ? "bg-white shadow-sm border" : "hover:bg-gray-200"}`}
              title="Penna"
            >
              <Pen className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTool("eraser")}
              className={`p-1.5 rounded-md transition-colors ${tool === "eraser" ? "bg-white shadow-sm border" : "hover:bg-gray-200"}`}
              title="Gomma"
            >
              <Eraser className="h-4 w-4" />
            </button>
          </div>

          <div className="h-4 w-px bg-gray-300" />

          {/* Colors */}
          {tool === "pen" && (
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${color === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : ""}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          )}

          {tool === "pen" && <div className="h-4 w-px bg-gray-300" />}

          {/* Size */}
          <div className="flex gap-1.5 items-center">
            {SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${size === s ? "bg-white shadow-sm border" : "hover:bg-gray-200"}`}
                title={`Spessore ${s}`}
              >
                <div
                  className="rounded-full bg-current"
                  style={{
                    width: Math.min(s * 2.5, 16),
                    height: Math.min(s * 2.5, 16),
                    color: tool === "pen" ? color : "#666",
                  }}
                />
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-gray-300 ml-auto" />

          {/* Clear */}
          <button
            onClick={() => {
              strokesRef.current = [];
              currentStrokeRef.current = [];
              setIsEmpty(true);
              redraw();
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-red-50"
            title="Cancella tutto"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cancella</span>
          </button>
        </div>

        {/* Scrollable canvas area */}
        <div
          ref={containerRef}
          className="overflow-y-auto rounded-b-xl border-x border-b"
          style={{ height: "420px", touchAction: "pan-y" }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            style={{
              cursor: tool === "eraser" ? "cell" : "crosshair",
              display: "block",
              touchAction: "none",
            }}
          />
        </div>

        <p className="text-xs text-muted-foreground text-center mt-1.5">
          Apple Pencil per scrivere · Scorri con il dito per navigare
        </p>
      </div>
    );
  }
);
