"use client";

import { useState } from "react";
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
// holds there. demo-script.ts's own timeline decides when the whole
// sequence (and the demo) ends, not this component.
export function DemoPdfReveal() {
  const pdfUrl = useDemoStore((s) => s.pdfUrl);
  const [prevPdfUrl, setPrevPdfUrl] = useState<string | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  // Adjusted during render, not an effect — same "adjusting state when a
  // prop changes" pattern used throughout the demo components. The CSS
  // animation (see globals.css's .animate-pdf-fade-up) handles the
  // actual fade/scale-up entirely on its own once mounted.
  if (pdfUrl !== prevPdfUrl) {
    setPrevPdfUrl(pdfUrl);
    setRect(pdfUrl ? targetRect() : null);
  }

  if (!pdfUrl || !rect) return null;

  return (
    <div
      key={pdfUrl}
      className="animate-pdf-fade-up pointer-events-none fixed z-[300] overflow-hidden rounded-2xl bg-white shadow-[0_40px_120px_rgba(0,0,0,0.5)]"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    >
      {/* Chrome's own PDF viewer shows its full toolbar + page-thumbnail
          sidebar by default (it looks like a print dialog, not a
          document) — these are Chrome's documented "open parameters"
          fragment, suppressing all of that down to just the page itself. */}
      <embed
        src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
        type="application/pdf"
        className="h-full w-full"
      />
    </div>
  );
}
