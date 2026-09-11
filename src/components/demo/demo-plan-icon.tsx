"use client";

import { useEffect, useState } from "react";
import { useDemoStore } from "@/hooks/use-demo-store";

// Beat 4: a "Houseplan" file-card icon (landscape card, red PDF badge,
// folded corner, caption — per mockups/Demo Video/demo_houseplan_icon_v5.html)
// flies from the middle of the screen into the real Plan button
// (hizzel-world.tsx's data-plan-button) and fades out as it arrives.
export function DemoPlanIcon() {
  const visible = useDemoStore((s) => s.planIconVisible);
  const [target, setTarget] = useState<{ left: number; top: number } | null>(null);
  const [arrived, setArrived] = useState(false);
  // Tracked in state, not a ref — this project's lint config forbids
  // touching a ref during render. Comparing against a bit of state itself
  // is React's own documented "adjusting state when a prop changes"
  // pattern: reset to a centered starting position the instant `visible`
  // flips true, during render, so the very first paint after becoming
  // visible already shows the centered start rather than a flash of
  // nothing (an effect would run a frame too late for that).
  const [prevVisible, setPrevVisible] = useState(false);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setTarget({ left: window.innerWidth / 2 - 60, top: window.innerHeight / 2 - 44 });
      setArrived(false);
    }
  }

  useEffect(() => {
    if (!visible) return;
    // Move to the real button's position on the next frame, so the CSS
    // transition has a genuine start (centered) and end (the button) to
    // animate between rather than both writes collapsing into one.
    const raf = requestAnimationFrame(() => {
      const button = document.querySelector<HTMLElement>("[data-plan-button]");
      const rect = button?.getBoundingClientRect();
      if (rect) {
        setTarget({ left: rect.left + rect.width / 2 - 60, top: rect.top + rect.height / 2 - 44 });
      }
      setArrived(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible || !target) return null;

  return (
    <div
      className="pointer-events-none fixed z-[200] flex h-[88px] w-[120px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-white shadow-[0_12px_36px_rgba(20,18,14,0.3)] transition-all duration-[900ms] ease-in-out"
      style={{
        left: target.left,
        top: target.top,
        clipPath: "polygon(0 0, 82% 0, 100% 18%, 100% 100%, 0 100%)",
        opacity: arrived ? 0 : 1,
        transform: arrived ? "scale(0.35)" : "scale(1)",
      }}
    >
      <div className="rounded-[10px] bg-[#C0392B] px-3 py-1.5 text-[13px] font-bold tracking-wide text-white">
        PDF
      </div>
      <div className="text-[8px] font-bold tracking-[0.04em] text-[#2C2A25] uppercase">Houseplan</div>
    </div>
  );
}
