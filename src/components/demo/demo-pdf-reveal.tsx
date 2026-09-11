"use client";

import { useEffect, useState } from "react";
import { useDemoStore } from "@/hooks/use-demo-store";

// How long each page holds on screen before the next one crossfades in.
const PAGE_HOLD_MS = 1400;
const CROSSFADE_MS = 500;
// The demo's own PDF always renders exactly 2 pages (verified against the
// scripted content in demo-data.ts) — two stacked iframes, one per page,
// crossfaded via opacity. Both are mounted (and so both load) from the
// moment the PDF appears, so paging never shows a blank reload flash the
// way changing one iframe's own src would.
const PAGES = [1, 2];

// Beat 7's finale: once my-hizzel-overlay.tsx's handleShare() sets pdfUrl,
// the real PDF appears full-screen (large enough to actually read),
// pages through both its pages, holds, then the whole demo finishes —
// driven by demo-script.ts's own timeline, not by this component.
export function DemoPdfReveal() {
  const pdfUrl = useDemoStore((s) => s.pdfUrl);
  const [prevPdfUrl, setPrevPdfUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);

  // Adjusted during render, not an effect — same "adjusting state when a
  // prop changes" pattern as demo-plan-icon.tsx, so the very first paint
  // once pdfUrl arrives already shows it, full screen, from page one.
  if (pdfUrl !== prevPdfUrl) {
    setPrevPdfUrl(pdfUrl);
    setVisible(!!pdfUrl);
    setPageIndex(0);
  }

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setPageIndex((i) => Math.min(i + 1, PAGES.length - 1));
    }, PAGE_HOLD_MS);
    return () => clearTimeout(timer);
  }, [visible, pageIndex]);

  if (!visible || !pdfUrl) return null;

  return (
    <div className="pointer-events-none fixed inset-6 z-[300] overflow-hidden rounded-2xl bg-white shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
      {PAGES.map((page, i) => (
        <iframe
          key={page}
          src={`${pdfUrl}#page=${page}&toolbar=0&navpanes=0&view=FitH`}
          title={`Things PDF, page ${page}`}
          className="absolute inset-0 h-full w-full border-0 transition-opacity ease-in-out"
          style={{
            opacity: i === pageIndex ? 1 : 0,
            transitionDuration: `${CROSSFADE_MS}ms`,
          }}
        />
      ))}
    </div>
  );
}
