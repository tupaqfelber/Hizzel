"use client";

import { useState, type CSSProperties } from "react";
import { useDemoStore } from "@/hooks/use-demo-store";

// A4 at 72pt/inch (595.28 x 841.89pt) — the demo's PDF is forced to a
// single page (see things-document.tsx's forceSinglePage), so the reveal
// is sized to that same page proportion rather than an arbitrary box.
const PAGE_ASPECT = 595.28 / 841.89;

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Sized by height first ("slightly smaller than the screen"), width
// derived from the real page aspect ratio — only falling back to a
// width-first fit if the viewport is too narrow for that height.
function targetRect(): Rect {
  const maxHeight = window.innerHeight - 60;
  const maxWidth = window.innerWidth - 40;
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

interface Geometry {
  rect: Rect;
  // Threaded into .animate-pdf-pop-out's --pdf-pop-* custom properties
  // (see globals.css) — the CSS animation itself handles the actual
  // "grow from the button" motion, computed once here from the real
  // Share button's own bounding rect relative to the final target rect.
  popVars: CSSProperties;
}

function computeGeometry(): Geometry {
  const rect = targetRect();
  const button = document.querySelector<HTMLElement>("[data-share-button]");
  const start = button?.getBoundingClientRect();
  if (!start) return { rect, popVars: {} };

  const sx = start.width / rect.width;
  const sy = start.height / rect.height;
  const tx = start.left + start.width / 2 - (rect.left + rect.width / 2);
  const ty = start.top + start.height / 2 - (rect.top + rect.height / 2);

  return {
    rect,
    popVars: {
      "--pdf-pop-tx": `${tx}px`,
      "--pdf-pop-ty": `${ty}px`,
      "--pdf-pop-sx": sx,
      "--pdf-pop-sy": sy,
    } as CSSProperties,
  };
}

// Beat 8's finale: once my-hizzel-overlay.tsx's handleShare() sets pdfUrl,
// the real (single-page) PDF pops out of the real Share button
// (data-share-button) to fill most of the screen's height, then just
// holds there — the reverse of demo-plan-icon.tsx's shrink-into-a-button.
// demo-script.ts's own timeline decides when the whole sequence (and the
// demo) ends, not this component.
export function DemoPdfReveal() {
  const pdfUrl = useDemoStore((s) => s.pdfUrl);
  const [prevPdfUrl, setPrevPdfUrl] = useState<string | null>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);

  // Adjusted during render, not an effect — same "adjusting state when a
  // prop changes" pattern used throughout the demo components. The
  // element is always rendered at its final, correct geometry; the CSS
  // animation (see globals.css) handles the "grow from the button"
  // motion entirely on its own once mounted.
  if (pdfUrl !== prevPdfUrl) {
    setPrevPdfUrl(pdfUrl);
    setGeometry(pdfUrl ? computeGeometry() : null);
  }

  if (!pdfUrl || !geometry) return null;

  return (
    <div
      key={pdfUrl}
      className="animate-pdf-pop-out pointer-events-none fixed z-[300] overflow-hidden rounded-2xl bg-white shadow-[0_40px_120px_rgba(0,0,0,0.5)]"
      style={{
        left: geometry.rect.left,
        top: geometry.rect.top,
        width: geometry.rect.width,
        height: geometry.rect.height,
        ...geometry.popVars,
      }}
    >
      <embed src={pdfUrl} type="application/pdf" className="h-full w-full" />
    </div>
  );
}
