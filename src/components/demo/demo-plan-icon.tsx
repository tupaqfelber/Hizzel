"use client";

import { useEffect, useState } from "react";
import { useDemoStore } from "@/hooks/use-demo-store";

// How long the card holds large and central before shrinking away.
const HOLD_MS = 1000;
const TRANSITION_MS = 700;

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Beat 5: a "Houseplan" file-card (landscape card, red PDF badge, folded
// corner, caption — per mockups/Demo Video/demo_houseplan_icon_v5.html)
// fades up large and central — the same scale of moment as the final PDF
// reveal — holds for a beat so it actually reads, then shrinks away into
// the real Plan/upload button (hizzel-world.tsx's data-plan-button), which
// flashes the instant it lands (see demo-script.ts).
export function DemoPlanIcon() {
  const visible = useDemoStore((s) => s.planIconVisible);
  const [prevVisible, setPrevVisible] = useState(false);
  const [stage, setStage] = useState<"hidden" | "entering" | "large" | "shrinking">("hidden");
  const [rect, setRect] = useState<Rect | null>(null);

  // Adjusted during render, not an effect — same "adjusting state when a
  // prop changes" pattern used throughout the demo components, so the
  // very first paint after becoming visible already has its large,
  // centered geometry ready (starting invisible — see the opacity logic
  // below — so the very next frame can fade it in).
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      const width = Math.min(480, window.innerWidth * 0.62);
      const height = Math.min(300, window.innerHeight * 0.5);
      setRect({
        left: window.innerWidth / 2 - width / 2,
        top: window.innerHeight / 2 - height / 2,
        width,
        height,
      });
      setStage("entering");
    } else {
      setStage("hidden");
      setRect(null);
    }
  }

  useEffect(() => {
    if (stage === "entering") {
      // One frame later, so the transition has a real 0→1 opacity change
      // to animate rather than both writes collapsing into one paint.
      const raf = requestAnimationFrame(() => setStage("large"));
      return () => cancelAnimationFrame(raf);
    }
    if (stage === "large") {
      const timer = setTimeout(() => {
        const button = document.querySelector<HTMLElement>("[data-plan-button]");
        const target = button?.getBoundingClientRect();
        if (target) {
          setRect({ left: target.left, top: target.top, width: target.width, height: target.height });
        }
        setStage("shrinking");
      }, HOLD_MS);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  if (stage === "hidden" || !rect) return null;

  const shown = stage === "large";

  return (
    <div
      className="pointer-events-none fixed z-[300] flex flex-col items-center justify-center gap-4 bg-white shadow-[0_40px_120px_rgba(0,0,0,0.5)] transition-all ease-in-out"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        opacity: shown ? 1 : 0,
        clipPath: "polygon(0 0, 90% 0, 100% 10%, 100% 100%, 0 100%)",
        transitionDuration: `${TRANSITION_MS}ms`,
      }}
    >
      {/* Folded-corner accent, cut into the notch above. */}
      <div
        className="absolute top-0 right-0 bg-[#E0DCD4]"
        style={{ width: "10%", aspectRatio: "1", clipPath: "polygon(100% 0, 100% 100%, 0 0)" }}
      />
      <div className="rounded-2xl bg-[#C0392B] px-8 py-5 text-3xl font-bold tracking-wide text-white">
        PDF
      </div>
      <div className="text-base font-bold tracking-[0.08em] text-[#2C2A25] uppercase">Houseplan</div>
    </div>
  );
}
