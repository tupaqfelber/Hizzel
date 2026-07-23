import { useEffect, useRef } from "react";

// Focuses the element after mount instead of using the native `autoFocus`
// attribute. `autoFocus` focuses as soon as the browser parses the element —
// on iOS Safari that can trigger autofill before React finishes hydrating,
// which touches the DOM out from under React and causes a hydration mismatch
// on any input that's part of the initial server-rendered HTML.
export function useAutoFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}
