"use client";

import { useEffect, useRef, useState } from "react";
import { ThingsWorld } from "@/components/things/things-world";
import { HizzelWorld } from "@/components/hizzel/hizzel-world";
import { MyHizzelOverlay } from "@/components/my-hizzel/my-hizzel-overlay";
import { PaywallSheet } from "@/components/billing/paywall-sheet";
import { useCurrentMove } from "@/hooks/use-current-move";
import { useIdentifyUser } from "@/hooks/use-identify-user";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { useDemoStore } from "@/hooks/use-demo-store";

const MOVE_THRESHOLD_PX = 5;
const SNAP_DURATION_MS = 250;
// Below this width, "desktop" ends and the mobile orientation split
// (landscape diptych vs portrait slider) takes over — matches Tailwind's
// default `lg` breakpoint exactly, since every `lg:`-scoped class already
// throughout the app assumes that boundary. Exported so welcome/page.tsx's
// own desktop-vs-landscape check means exactly the same thing as it does
// here, rather than a second hardcoded number drifting out of sync.
export const DESKTOP_BREAKPOINT_PX = 1024;
// A resting Full stop still leaves this much of the *other* world visible
// as a compact "sliver" (logo + one line of context) rather than shrinking
// it to nothing — the whole point of the sliver is a permanent reminder
// the other world still exists, one tap/swipe away.
const SLIVER_PX = 84;
// The divide's drag/tap hit area is a real DIVIDE_HIT_PX-tall strip centred
// on the seam, not a height:0 sliver — startBarDrag's tapped-third math
// divides by its own bounding rect's height, so a zero-height rect made
// every tap on it resolve to NaN and silently do nothing.
const DIVIDE_HIT_PX = 64;

// Portrait's three resting stops. Landscape and desktop ignore this
// entirely — both worlds are always fully visible there, no slider at all.
function nearestStop(position: number): 0 | 0.5 | 1 {
  if (position < 0.25) return 0;
  if (position < 0.75) return 0.5;
  return 1;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

// "desktop" and "landscape" both mean "always-visible diptych, no
// slider" — split into two values (rather than one shared "diptych")
// because Things' own controls row is structurally different between the
// three non-full-height contexts (desktop's existing layout, landscape's
// single compact row, portrait-mid's matching compact row), not just a
// sizing-tier difference. HizzelWorld doesn't need the distinction — its
// header/toolbar shape is identical between desktop and landscape, only
// the CSS sizing tier (lg: vs max-lg:landscape:) differs — but takes the
// same five-value type for consistency between the two components.
export type WorldMode = "desktop" | "landscape" | "full" | "mid" | "sliver";

export function AppShell({ initialStop }: { initialStop: "things" | "hizzel" | "mid" }) {
  useIdentifyUser();
  const { data: move } = useCurrentMove();
  const demoActive = useDemoStore((s) => s.active);
  const demoOverlayOpen = useDemoStore((s) => s.overlayOpen);
  const [myHizzelOpen, setMyHizzelOpen] = useState(false);
  // The script (demo-script.ts) opens/closes My Hizzel on its own cues —
  // real taps still work exactly as before once the demo isn't active.
  const effectiveMyHizzelOpen = demoActive ? demoOverlayOpen : myHizzelOpen;
  const [position, setPosition] = useState(initialStop === "hizzel" ? 1 : initialStop === "things" ? 0 : 0.5);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  // Desktop (>=1024px) and mobile landscape both get the always-visible
  // diptych, just at different sizing tiers (CSS's own lg: vs
  // max-lg:landscape: classes handle that split, not this JS value) — the
  // slider only exists for portrait, below the desktop breakpoint.
  const [isDesktopWidth, setIsDesktopWidth] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  // The demo always runs in the split-screen view, regardless of the real
  // device's actual size/orientation — it's mounted inside the same
  // forced-landscape rotation wrapper welcome/page.tsx uses (see
  // demo-player.tsx), so this just has to agree with that, not re-detect it.
  const isDiptych = demoActive || isDesktopWidth || isLandscape;
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Layout effect, not a plain effect: this needs to settle *before* the
  // first paint, not after — HizzelWorld's own canvas-size effect (also a
  // layout effect, see hizzel-world.tsx) reads the `mode` this produces,
  // and layout effects run parent-before-child in the same pre-paint pass.
  // A plain effect here would let the very first paint (and the canvas's
  // own first measurement) happen against the SSR-safe "not landscape yet"
  // fallback mode, then correct a frame later — by which point the canvas
  // had already cached a measurement from the wrong, transient geometry.
  useIsomorphicLayoutEffect(() => {
    function update() {
      setViewportHeight(window.innerHeight);
      setViewportWidth(window.innerWidth);
      setIsDesktopWidth(window.innerWidth >= DESKTOP_BREAKPOINT_PX);
      setIsLandscape(window.innerWidth > window.innerHeight);
    }
    update();
    window.addEventListener("resize", update);
    // iOS Safari's `resize` event is unreliable specifically around a
    // rotation: it can fire while the address-bar chrome is still
    // animating, reporting innerWidth/innerHeight from a half-settled
    // layout rather than the final one — a live report showed exactly
    // this (rotating while Full-Hizzel produced a too-narrow landscape
    // width). `orientationchange` fires on the rotation itself, and a
    // couple of delayed re-checks afterward catch whatever `resize`
    // reported too early, once the chrome has actually finished settling.
    function handleOrientationChange() {
      update();
      setTimeout(update, 120);
      setTimeout(update, 400);
    }
    window.addEventListener("orientationchange", handleOrientationChange);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
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

  const stop = nearestStop(position);
  // Raw proportional split, then floor each side at SLIVER_PX so neither
  // ever visually disappears — the "minority" side settles at a permanent
  // peek height instead of 0, and the other absorbs the remainder. This
  // holds throughout the whole drag, not just at rest, so there's no jump
  // between "dragging" and "settled" visuals near either end.
  const rawThingsPx = (1 - position) * viewportHeight;
  const thingsSizePx = Math.min(Math.max(rawThingsPx, SLIVER_PX), viewportHeight - SLIVER_PX);
  const hizzelSizePx = viewportHeight - thingsSizePx;
  // Landscape's own sizing: an explicit pixel width/height computed
  // directly from the same viewportWidth/viewportHeight state that
  // decides orientation in the first place — not a CSS percentage
  // (width:50%, height:100%) resolved against the ancestor chain. A live
  // report showed the canvas measuring a stale, portrait-shaped size
  // despite `mode` correctly reading "landscape"; percentages depend on
  // every ancestor having already settled its own box before the child
  // resolves, which is exactly the kind of thing that can lag a beat
  // behind a real device's orientation change. A plain number computed
  // once, here, has nothing to resolve — it just is what it is.
  const landscapeWidthPx = Math.round(viewportWidth / 2);

  const diptychMode: WorldMode = isDesktopWidth ? "desktop" : "landscape";
  const thingsMode: WorldMode = isDiptych ? diptychMode : stop === 0.5 ? "mid" : stop === 0 ? "full" : "sliver";
  const hizzelMode: WorldMode = isDiptych ? diptychMode : stop === 0.5 ? "mid" : stop === 1 ? "full" : "sliver";

  // Vertical equivalent of the old horizontal bar-drag: three equal-height
  // tap targets (one per stop), drag-to-nearest-stop otherwise. Portrait
  // only — isDiptych ignores this whole mechanism, same as desktop always
  // has.
  function startBarDrag(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    if (animationRef.current) clearTimeout(animationRef.current);
    const startY = e.clientY;
    const startPosition = position;
    const rect = e.currentTarget.getBoundingClientRect();
    const tappedThird = Math.min(2, Math.max(0, Math.floor((3 * (startY - rect.top)) / rect.height)));
    const tappedStop = ([0, 0.5, 1] as const)[tappedThird];
    let moved = false;

    // Dragging the handle down should feel like pulling the boundary line
    // down with your finger — which *grows* Things (above the boundary),
    // not Hizzel. Since position=0 means Things-full, moving the boundary
    // down means moving position *toward* 0 — i.e. subtracting dy, not
    // adding it. (Reported live: dragging down was growing the lower half
    // instead of the upper one — this sign was backward.)
    function handleMove(ev: PointerEvent) {
      const dy = ev.clientY - startY;
      if (Math.abs(dy) > MOVE_THRESHOLD_PX) moved = true;
      const next = Math.min(1, Math.max(0, startPosition - dy / window.innerHeight));
      setPosition(next);
    }

    function handleUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);

      if (!moved) {
        animateTo(tappedStop);
        return;
      }

      const dy = ev.clientY - startY;
      const finalRaw = Math.min(1, Math.max(0, startPosition - dy / window.innerHeight));
      animateTo(nearestStop(finalRaw));
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    // Row/column is driven by the same isDiptych JS state that decides
    // `mode` for both children, not a separate CSS orientation media query
    // — a real device's window.innerHeight shifts as Safari's toolbar
    // shows/hides, which can transiently disagree with the `orientation`
    // media feature. When those two signals disagreed, HizzelWorld would
    // render mode="landscape" (width:50%,height:100%) while its actual
    // parent was still column-flex — a live report showed exactly this:
    // the canvas measured a stale, portrait-shaped size despite mode
    // correctly reading "landscape". One source of truth for both settles it.
    <div className={`relative flex h-dvh w-dvw overflow-hidden ${isDiptych ? "flex-row" : "flex-col"}`}>
      <ThingsWorld
        mode={thingsMode}
        sizePx={thingsSizePx}
        landscapeWidthPx={landscapeWidthPx}
        landscapeHeightPx={viewportHeight}
        // The Things sliver (visible at Full-Hizzel) always returns to the
        // balanced Mid view, not all the way to Full-Things — same "one tap
        // gets you back to seeing both worlds" behaviour as the arrow pill.
        onJumpToHizzel={() => animateTo(0.5)}
        // At the Full-Things stop, the Hizzel sliver below is a static
        // preview, not a real canvas — a card drag started there still has
        // nowhere real to land. Reveal Mid the instant a drag begins, same
        // reasoning as before, just retargeted to the vertical axis.
        onDragStart={() => {
          if (!isDiptych && stop === 0) animateTo(0.5);
        }}
        // Mid's own expand affordance lives in Things' header, not the
        // shared divide — a plain "make me fullscreen" button per panel,
        // with no direction to get backward.
        onExpand={() => animateTo(0)}
      />
      <HizzelWorld
        mode={hizzelMode}
        sizePx={hizzelSizePx}
        landscapeWidthPx={landscapeWidthPx}
        landscapeHeightPx={viewportHeight}
        onJumpToFull={() => animateTo(0.5)}
        onExpand={() => animateTo(1)}
      />

      {/* The divide: drag handle + stop-jump arrows + "My Hizzel" pill.
          Portrait only — landscape and desktop both show both worlds
          permanently, nothing to divide between. The drag handle is a real
          DIVIDE_HIT_PX-tall hit area centred on the seam (not a height:0
          sliver) — startBarDrag's tapped-third math divides by its own
          rect.height, so a zero-height rect broke every tap silently. */}
      {!isDiptych && (
        <div
          onPointerDown={startBarDrag}
          className="absolute inset-x-0 z-30 flex touch-none items-center justify-center"
          style={{ top: `${thingsSizePx - DIVIDE_HIT_PX / 2}px`, height: `${DIVIDE_HIT_PX}px` }}
        >
          {stop === 0.5 ? (
            // At Mid there's nothing to jump to from the divide itself —
            // each panel has its own "expand" button in its header now, no
            // shared directional arrows to get backward. Just a plain grip
            // to show this bar is draggable.
            <div className="pointer-events-none absolute left-5 h-1 w-8 rounded-full bg-[rgba(245,242,236,0.35)]" />
          ) : (
            // A directional chevron pointing toward Things when at
            // Full-Things (stop 0) and toward Hizzel when at Full-Hizzel
            // (stop 1) — matches the drag gesture's own corrected sign:
            // dragging down grows Things, so from Full-Things the "back to
            // Mid" direction is up, and from Full-Hizzel it's down.
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => animateTo(0.5)}
              aria-label="Back to My Things and Hizzel side by side"
              className="pointer-events-auto absolute left-5 flex items-center justify-center rounded-2xl bg-[#2C2A25] p-2 shadow-lg"
            >
              <svg width="14" height="8" viewBox="0 0 14 8" fill="none" className="shrink-0">
                <path
                  d={stop === 0 ? "M1 7L7 1L13 7" : "M1 1L7 7L13 1"}
                  stroke="#F5F2EC"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setMyHizzelOpen(true)}
            aria-label="Open My Hizzel"
            className="pointer-events-auto flex items-center rounded-full bg-linen px-5 py-2 font-serif text-xs text-linen-ink shadow-[0_4px_14px_rgba(20,18,14,0.32)]"
          >
            My Hizzel
          </button>
        </div>
      )}

      {/* Desktop's own "My Hizzel" pill also covers landscape now — same
          treatment, just gated on isDiptych rather than a bare lg: class. */}
      {move && isDiptych && (
        <button
          type="button"
          onClick={() => setMyHizzelOpen(true)}
          aria-label="Open My Hizzel"
          className="fixed bottom-7 left-1/2 z-30 flex -translate-x-1/2 items-center rounded-full bg-dark-ink px-5 py-2.5 font-serif text-[13px] tracking-[0.02em] whitespace-nowrap text-dark shadow-lg"
        >
          My Hizzel
        </button>
      )}

      {effectiveMyHizzelOpen && <MyHizzelOverlay onClose={() => setMyHizzelOpen(false)} />}
      <PaywallSheet />
    </div>
  );
}
