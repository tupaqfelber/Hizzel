"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useDemoStore } from "@/hooks/use-demo-store";
import { runDemoScript } from "@/lib/demo/demo-script";
import { DemoPlanIcon } from "@/components/demo/demo-plan-icon";

// Runs the ~24s scripted "Watch demo" sequence: a real <AppShell>, forced
// into demo mode (see useDemoStore + the patched data hooks it feeds),
// forced into the landscape split-screen view exactly like welcome/page.tsx
// forces landscape regardless of the device's actual orientation, with a
// transparent tap-anywhere-to-skip layer on top of everything.
export function DemoPlayer() {
  const [isPhysicallyPortrait, setIsPhysicallyPortrait] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    function update() {
      setIsPhysicallyPortrait(window.innerWidth <= window.innerHeight);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Shared by the script's own natural end and the tap-to-skip layer —
  // "hands off to Let's begin whether it finished or was skipped" means
  // both paths land in the same place, the real Welcome screen. A hard
  // navigation, not router.push — this page's forced-landscape rotation
  // wrapper (position: fixed + a CSS rotate transform) can leave a stale
  // compositor frame behind on a soft client-side unmount; a full
  // navigation guarantees a clean repaint of the real Welcome screen.
  const handleFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    useDemoStore.getState().finish();
    window.location.href = "/welcome";
  }, []);

  useEffect(() => {
    finishedRef.current = false;
    useDemoStore.getState().start();
    const stop = runDemoScript(useDemoStore.getState().patch, handleFinish);
    return () => {
      stop();
      useDemoStore.getState().finish();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const content = (
    <div className="relative h-full w-full">
      <AppShell initialStop="mid" />
      <DemoPlanIcon />
      <button
        type="button"
        onClick={handleFinish}
        aria-label="Skip demo"
        // Sits above everything (AppShell's own overlays included) and
        // intercepts every pointer event — nothing inside the real
        // components needs to be individually disabled during playback.
        className="absolute inset-0 z-[500] cursor-pointer bg-transparent"
      />
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
