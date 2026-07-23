"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "posthog-js/react";
import { useState } from "react";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  const app = (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  if (!posthogKey) {
    return app;
  }

  return (
    <PostHogProvider
      apiKey={posthogKey}
      options={{
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        person_profiles: "identified_only",
        capture_pageview: true,
      }}
    >
      {app}
    </PostHogProvider>
  );
}
