import { useEffect, useLayoutEffect } from "react";

// Plain useLayoutEffect warns on the server ("does nothing on the server,
// did you mean useEffect?") since "use client" components still render
// server-side for the initial HTML. Falls back to useEffect there and only
// gets the real (pre-paint, synchronous) layout-effect timing on the
// client — which is what matters for measurement-after-a-mode-change: it
// lets a parent's orientation correction and a child's canvas-size
// re-measurement both settle before anything is ever painted, instead of a
// child measuring once against a since-corrected, wrong transient layout.
export const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
