"use client";

import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";
import { createClient } from "@/lib/supabase/client";

// Fixes a gap in the PostHog setup: person_profiles is "identified_only"
// (set from the start in app-providers.tsx), but identify() was never
// called anywhere — every event so far, pageviews included, has been
// silently dropped from person-level analytics. Called once from
// AppShell, which every authenticated page always mounts, so this covers
// a returning session reopening the app. A fresh login is covered
// separately by login/page.tsx's own identify() call right after OTP
// verification succeeds.
export function useIdentifyUser() {
  const posthog = usePostHog();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) {
        posthog?.identify(user.id, { email: user.email });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [posthog]);
}
