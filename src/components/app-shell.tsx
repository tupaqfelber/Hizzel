"use client";

import { useEffect, useRef, useState } from "react";
import { ThingsWorld } from "@/components/things/things-world";
import { HizzelWorld } from "@/components/hizzel/hizzel-world";
import { HizzelMidPanel } from "@/components/hizzel/hizzel-mid-panel";
import { MyHizzelOverlay } from "@/components/my-hizzel/my-hizzel-overlay";
import { useCurrentMove } from "@/hooks/use-current-move";

const MOVE_THRESHOLD_PX = 5;
const SNAP_DURATION_MS = 250;

// The three resting positions of the mobile Things <-> Hizzel slider:
// 0 = Things full, 0.5 = Mid (both worlds visible, mobile-sized diptych),
// 1 = Hizzel full. Desktop ignores this entirely (fixed 50/50 via lg:!w-1/2).
function nearestStop(position: number): 0 | 0.5 | 1 {
  if (position < 0.25) return 0;
  if (position < 0.75) return 0.5;
  return 1;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function AppShell({ initialStop }: { initialStop: "things" | "hizzel" }) {
  const { data: move } = useCurrentMove();
  const [myHizzelOpen, setMyHizzelOpen] = useState(false);
  const [position, setPosition] = useState(initialStop === "hizzel" ? 1 : 0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function updateWidth() {
      setViewportWidth(window.innerWidth);
    }
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    return () => {
      if (animationRef.current) clearTimeout(animationRef.current);
    };
  }, []);

  // Driven by setTimeout rather than requestAnimationFrame: rAF (and CSS
  // transitions) get suspended when the tab isn't visible/focused, which
  // would leave the slider permanently stuck mid-gesture if focus is lost
  // (e.g. a notification pulling focus away on a phone). setTimeout keeps
  // running regardless, so the snap always completes.
  function animateTo(target: number) {
    if (animationRef.current) clearTimeout(animationRef.current);
    const start = position;
    const startTime = Date.now();

    function step() {
      const t = Math.min(1, (Date.now() - startTime) / SNAP_DURATION_MS);
      setPosition(start + (target - start) * easeOutCubic(t));
      if (t < 1) {
        animationRef.current = setTimeout(step, 16);
      } else {
        animationRef.current = null;
      }
    }
    step();
  }

  const thingsWidthPx = (1 - position) * viewportWidth;
  const hizzelWidthPx = position * viewportWidth;
  const thingsWidthPercent = (1 - position) * 100;
  const stop = nearestStop(position);

  function startBarDrag(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    if (animationRef.current) clearTimeout(animationRef.current);
    const startX = e.clientX;
    const startPosition = position;
    const rect = e.currentTarget.getBoundingClientRect();
    // Three equal-width tap targets, one per stop — a plain tap jumps
    // straight to whichever segment was tapped.
    const tappedThird = Math.min(2, Math.max(0, Math.floor((3 * (startX - rect.left)) / rect.width)));
    const tappedStop = ([0, 0.5, 1] as const)[tappedThird];
    let moved = false;

    function handleMove(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      if (Math.abs(dx) > MOVE_THRESHOLD_PX) moved = true;
      const next = Math.min(1, Math.max(0, startPosition + dx / window.innerWidth));
      setPosition(next);
    }

    function handleUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);

      if (!moved) {
        animateTo(tappedStop);
        return;
      }

      const dx = ev.clientX - startX;
      const finalRaw = Math.min(1, Math.max(0, startPosition + dx / window.innerWidth));
      animateTo(nearestStop(finalRaw));
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <div className="relative flex h-dvh w-dvw overflow-hidden">
      <ThingsWorld widthPx={thingsWidthPx} onJumpToHizzel={() => animateTo(1)} />
      <HizzelWorld widthPx={hizzelWidthPx} mobileActive={stop === 1} />
      <HizzelMidPanel
        widthPx={hizzelWidthPx}
        mobileActive={stop !== 1}
        onExpand={() => animateTo(1)}
      />

      {position > 0 && position < 1 && (
        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-px bg-[rgba(100,95,88,0.2)] lg:hidden"
          style={{ left: `${thingsWidthPercent}%` }}
        />
      )}

      <div
        onPointerDown={startBarDrag}
        className="fixed bottom-7 left-1/2 z-30 flex w-[220px] -translate-x-1/2 touch-none gap-0.5 rounded-full bg-[#2A2820] p-[3px] shadow-lg lg:hidden"
      >
        <div
          className={`flex-1 rounded-full py-2 text-center font-display-italic text-sm transition-colors ${
            stop === 0 ? "bg-white text-[#1A1814]" : "text-white/35"
          }`}
        >
          Things
        </div>
        <div
          className={`flex flex-1 items-center justify-center gap-1 rounded-full transition-colors ${
            stop === 0.5 ? "bg-white/15" : ""
          }`}
        >
          <div
            className={`h-0 w-0 border-y-4 border-r-[6px] border-y-transparent ${
              stop === 0.5 ? "border-r-white/80" : "border-r-white/30"
            }`}
          />
          <div
            className={`h-0 w-0 border-y-4 border-l-[6px] border-y-transparent ${
              stop === 0.5 ? "border-l-white/80" : "border-l-white/30"
            }`}
          />
        </div>
        <div
          className={`flex-1 rounded-full py-2 text-center font-serif text-[13px] tracking-[0.05em] transition-colors ${
            stop === 1 ? "bg-white text-[#1A1814]" : "text-white/35"
          }`}
        >
          Hizzel
        </div>
      </div>

      {move && (
        <button
          type="button"
          onClick={() => setMyHizzelOpen(true)}
          aria-label="Open My Hizzel"
          className="fixed bottom-7 left-1/2 z-30 hidden -translate-x-1/2 items-center rounded-full bg-dark-ink px-5 py-2.5 font-serif text-[13px] tracking-[0.02em] whitespace-nowrap text-dark shadow-lg lg:flex"
        >
          My Hizzel
        </button>
      )}

      {myHizzelOpen && <MyHizzelOverlay onClose={() => setMyHizzelOpen(false)} />}
    </div>
  );
}
