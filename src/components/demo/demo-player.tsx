"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import { useDemoStore } from "@/hooks/use-demo-store";
import { runDemoScript } from "@/lib/demo/demo-script";
import { DemoPlanIcon } from "@/components/demo/demo-plan-icon";
import { DemoPdfReveal } from "@/components/demo/demo-pdf-reveal";

// Runs the ~24s scripted "Watch demo" sequence: a real <AppShell>, forced
// into demo mode (see useDemoStore + the patched data hooks it feeds),
// forced into the landscape split-screen view exactly like welcome/page.tsx
// forces landscape regardless of the device's actual orientation, with a
// transparent tap-anywhere-to-skip layer on top of everything.
export function DemoPlayer() {
  const [isPhysicallyPortrait, setIsPhysicallyPortrait] = useState(false);
  const [showLetsBegin, setShowLetsBegin] = useState(false);
  const [beginning, setBeginning] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    function update() {
      const portrait = window.innerWidth <= window.innerHeight;
      setIsPhysicallyPortrait(portrait);
      // See use-demo-store.ts's own comment on rotatedMaxHeightPx — only
      // meaningful (non-null) while the rotation wrapper below is
      // actually applied, so any vh-sized modal (my-hizzel-overlay.tsx)
      // rendered inside it has the real pixel budget to size against
      // instead of a `vh` unit that ignores the rotation entirely.
      useDemoStore.getState().patch({ rotatedMaxHeightPx: portrait ? window.innerWidth : null });
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // The tap-anywhere-to-skip layer's own handler — bails straight back to
  // the real Welcome screen from anywhere mid-playback. A hard navigation,
  // not router.push — this page's forced-landscape rotation wrapper
  // (position: fixed + a CSS rotate transform) can leave a stale
  // compositor frame behind on a soft client-side unmount; a full
  // navigation guarantees a clean repaint of the real Welcome screen.
  const handleSkip = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    useDemoStore.getState().finish();
    window.location.href = "/welcome";
  }, []);

  // Reveals "Let's begin" a fixed hold after the real PDF actually
  // arrives — not at a fixed point on the script's own clock. The PDF is
  // a real fetch (my-hizzel-overlay.tsx's handleShare() hitting
  // /api/things/pdf/demo), and how long that takes varies with the
  // server (a cold serverless instance is slower than a warm local dev
  // server) — a fixed timer that assumed a fast fetch could let this
  // button appear before the PDF itself ever showed up, which is exactly
  // what happened on a real deploy. Triggering off pdfUrl arriving
  // instead guarantees the PDF is always shown first, however long the
  // fetch actually took.
  const pdfUrl = useDemoStore((s) => s.pdfUrl);
  const PDF_HOLD_BEFORE_BEGIN_MS = 3000;

  useEffect(() => {
    if (!pdfUrl) return;
    const timer = setTimeout(() => setShowLetsBegin(true), PDF_HOLD_BEFORE_BEGIN_MS);
    return () => clearTimeout(timer);
  }, [pdfUrl]);

  // Safety net: if the PDF fetch ever fails outright (handleShare's own
  // catch just logs and swallows the error, so pdfUrl above would never
  // arrive), this generous absolute ceiling still reveals "Let's begin"
  // so a real failure can't strand a viewer with no way to continue.
  useEffect(() => {
    const timer = setTimeout(() => setShowLetsBegin(true), 35_000);
    return () => clearTimeout(timer);
  }, []);

  // Leads straight into the real app rather than bouncing back through
  // the Welcome screen a second time, same as welcome/page.tsx's own CTA.
  const handleBegin = useCallback(async () => {
    if (finishedRef.current || beginning) return;
    setBeginning(true);
    finishedRef.current = true;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id);
    }
    useDemoStore.getState().finish();
    window.location.href = "/";
  }, [beginning]);

  useEffect(() => {
    finishedRef.current = false;
    useDemoStore.getState().start();
    // start() resets the whole snapshot (rotatedMaxHeightPx included) —
    // re-assert it fresh right after, rather than relying on effect
    // declaration order against the orientation-tracking effect above.
    const portrait = window.innerWidth <= window.innerHeight;
    useDemoStore.getState().patch({ rotatedMaxHeightPx: portrait ? window.innerWidth : null });
    const stop = runDemoScript(useDemoStore.getState().patch);
    return () => {
      stop();
      useDemoStore.getState().finish();
    };
  }, []);

  const content = (
    <div className="relative h-full w-full">
      <AppShell initialStop="mid" />
      <DemoPlanIcon />
      <DemoPdfReveal />
      {showLetsBegin ? (
        <div className="animate-pdf-fade-up pointer-events-none fixed inset-x-0 bottom-10 z-[600] flex justify-center">
          <button
            type="button"
            onClick={handleBegin}
            disabled={beginning}
            // The same .animate-demo-flash ring every other simulated-tap
            // button in the demo gets (My Hizzel, + New move, Plan,
            // Share) — this is the final, most important call to action,
            // so it earns the same "tap here" cue as it appears, not just
            // a plain fade-up. Plays once automatically on mount, right
            // alongside the fade-up on the wrapping div.
            className="animate-demo-flash pointer-events-auto inline-flex items-center gap-2 rounded-full bg-amber-ink px-8 py-3 font-serif text-base text-[#5C3A18] shadow-[0_4px_16px_rgba(26,24,20,0.22)] disabled:opacity-60"
          >
            {beginning ? "One moment…" : "Let's begin"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSkip}
          aria-label="Skip demo"
          // Sits above everything (AppShell's own overlays included) and
          // intercepts every pointer event — nothing inside the real
          // components needs to be individually disabled during playback.
          // Swapped out for the real "Let's begin" button once the script
          // finishes, rather than staying active underneath it — the
          // finished hold is meant to be read, not tapped past.
          className="absolute inset-0 z-[500] cursor-pointer bg-transparent"
        />
      )}
    </div>
  );

  if (!isPhysicallyPortrait) {
    return <div className="h-dvh w-dvw">{content}</div>;
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#7A4E20]">
      <div
        className="absolute left-0 top-full"
        style={{
          width: "100vh",
          height: "100vw",
          transform: "rotate(-90deg)",
          transformOrigin: "left top",
        }}
      >
        {content}
      </div>
    </div>
  );
}
