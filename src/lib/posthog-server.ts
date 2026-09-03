import { PostHog } from "posthog-node";

let client: PostHog | null = null;

// Reuses the same project API key the client SDK uses — PostHog accepts
// server-side captures under the same key. flushAt/flushInterval are tuned
// for a short-lived Route Handler invocation rather than a long-running
// process: the default batching could mean the function returns (and the
// runtime freezes/exits) before a batched flush ever fires. Callers must
// still `await client.shutdown()` before returning, to force the flush.
export function getPostHogServerClient(): PostHog {
  if (client) return client;
  client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "", {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}
