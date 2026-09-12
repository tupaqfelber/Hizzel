"use client";

import { useEffect, useRef, useState } from "react";
import { useDemoStore } from "@/hooks/use-demo-store";

// A4 at 72pt/inch (595.28 x 841.89pt) — the demo's PDF is forced to a
// single page (see things-document.tsx's forceSinglePage), so the reveal
// is sized to that same portrait page proportion.
const PAGE_ASPECT = 595.28 / 841.89;
// A little padding around it so it never touches the screen's own edges.
const PADDING_PX = 28;

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Centred, portrait, as tall as it can go within PADDING_PX of the
// screen — width only falls back to the narrower, width-first fit on a
// viewport too narrow for that height to keep its portrait proportions.
function targetRect(): Rect {
  const maxHeight = window.innerHeight - PADDING_PX * 2;
  const maxWidth = window.innerWidth - PADDING_PX * 2;
  let height = maxHeight;
  let width = height * PAGE_ASPECT;
  if (width > maxWidth) {
    width = maxWidth;
    height = width / PAGE_ASPECT;
  }
  return {
    left: window.innerWidth / 2 - width / 2,
    top: window.innerHeight / 2 - height / 2,
    width,
    height,
  };
}

// Beat 8's finale: once my-hizzel-overlay.tsx's handleShare() sets pdfUrl,
// the real (single-page) PDF fades/scales up centred on screen — the same
// simple, centred treatment as demo-plan-icon.tsx's own reveal — and just
// holds there. demo-script.ts's own timeline decides when to reveal the
// "Let's begin" button, not this component.
//
// This renders the page onto a plain <canvas> via pdfjs-dist rather than
// handing the blob to an <embed>/<iframe> — Chrome's own built-in PDF
// viewer can't be fully tamed: even with its toolbar/sidebar suppressed
// via URL fragment, it still draws the page onto its own dark "desk"
// backdrop, which shows through as an inconsistent black band or shadow
// whenever the fitted page doesn't exactly fill the element (and that fit
// is a black box we don't control). Rasterising the page ourselves means
// there's no other renderer's chrome or backdrop left to fight — just our
// own white card and single shadow, the same clean look as the Houseplan
// card (demo-plan-icon.tsx) right before it.
export function DemoPdfReveal() {
  const pdfUrl = useDemoStore((s) => s.pdfUrl);
  const [prevPdfUrl, setPrevPdfUrl] = useState<string | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Adjusted during render, not an effect — same "adjusting state when a
  // prop changes" pattern used throughout the demo components. The CSS
  // animation (see globals.css's .animate-pdf-fade-up) handles the
  // actual fade/scale-up entirely on its own once mounted.
  if (pdfUrl !== prevPdfUrl) {
    setPrevPdfUrl(pdfUrl);
    setRect(pdfUrl ? targetRect() : null);
  }

  // Renders page 1 onto the canvas at devicePixelRatio resolution
  // whenever the URL or the target size changes, so it stays crisp
  // rather than upscaling a lower-res raster.
  useEffect(() => {
    if (!pdfUrl || !rect) return;
    let cancelled = false;
    (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const doc = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
      if (cancelled) return;
      const page = await doc.getPage(1);
      if (cancelled) return;
      const dpr = window.devicePixelRatio || 1;
      const unscaled = page.getViewport({ scale: 1 });
      const scale = (rect.width * dpr) / unscaled.width;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl, rect]);

  if (!pdfUrl || !rect) return null;

  return (
    <div
      key={pdfUrl}
      className="animate-pdf-fade-up pointer-events-none fixed z-[300] overflow-hidden rounded-2xl bg-white shadow-[0_40px_120px_rgba(0,0,0,0.5)]"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
