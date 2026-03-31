"use client";

import { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { getStroke } from "perfect-freehand";

interface Point {
  x: number;
  y: number;
  pressure: number;
}

interface Stroke {
  points: Point[];
  color: string;
  size: number;
}

export interface DrawingCanvasRef {
  exportPng: () => Promise<Blob | null>;
  clear: () => void;
  isEmpty: () => boolean;
}

interface DrawingCanvasProps {
  className?: string;
  style?: React.CSSProperties;
}

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

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  function DrawingCanvas({ className, style }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const strokesRef = useRef<Stroke[]>([]);
    const currentStrokeRef = useRef<Point[]>([]);
    const isDrawingRef = useRef(false);
    const [isEmpty, setIsEmpty] = useState(true);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      exportPng: async () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        return new Promise((resolve) => {
          canvas.toBlob((blob) => resolve(blob), "image/png", 1.0);
        });
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

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const stroke of strokesRef.current) {
        const outlinePoints = getStroke(stroke.points, {
          size: stroke.size,
          thinning: 0.5,
          smoothing: 0.5,
          streamline: 0.5,
          simulatePressure: false,
        });
        const path = new Path2D(getSvgPathFromStroke(outlinePoints));
        ctx.fillStyle = stroke.color;
        ctx.fill(path);
      }
    }, []);

    // Size canvas to container
    useEffect(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const observer = new ResizeObserver(() => {
        const { width, height } = container.getBoundingClientRect();
        // Use device pixel ratio for sharp rendering
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
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
      // Only Apple Pencil (pointerType === "pen") or mouse — ignore finger touch
      if (e.pointerType === "touch") return;

      e.preventDefault();
      canvasRef.current?.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;
      const pt = getPos(e.nativeEvent);
      currentStrokeRef.current = [pt];
      setIsEmpty(false);
    }

    function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!isDrawingRef.current) return;
      e.preventDefault();

      // Use coalesced events for smoother lines
      const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
      for (const ev of events) {
        currentStrokeRef.current.push(getPos(ev));
      }

      // Draw current stroke in progress
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      redraw();

      // Draw current in-progress stroke
      const outlinePoints = getStroke(currentStrokeRef.current, {
        size: 4,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: false,
      });
      const path = new Path2D(getSvgPathFromStroke(outlinePoints));
      ctx.fillStyle = "#1a1a1a";
      ctx.fill(path);
    }

    function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      isDrawingRef.current = false;

      if (currentStrokeRef.current.length > 0) {
        strokesRef.current.push({
          points: [...currentStrokeRef.current],
          color: "#1a1a1a",
          size: 4,
        });
        currentStrokeRef.current = [];
        redraw();
      }
    }

    return (
      <div
        ref={containerRef}
        className={className}
        style={{ touchAction: "none", ...style }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{
            cursor: "crosshair",
            display: "block",
            width: "100%",
            height: "100%",
          }}
        />
      </div>
    );
  }
);
