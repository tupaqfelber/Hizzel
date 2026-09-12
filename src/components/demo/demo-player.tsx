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
      setIsPhysicallyPortrait(window.innerWidth <= window.innerHeight);
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

  // The script's own natural end no longer auto-finishes — it holds on
  // the finished PDF and calls this to reveal a real "Let's begin" button
  // instead, same as welcome/page.tsx's own CTA, so watching the demo
  // through leads straight into the real app rather than bouncing back
  // through the Welcome screen a second time.
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
    const stop = runDemoScript(useDemoStore.getState().patch, () => setShowLetsBegin(true));
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
