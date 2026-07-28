import Anthropic from "@anthropic-ai/sdk";

// Server-only — never import this from a client component. Throws a clear,
// catchable error when the key is missing rather than letting the SDK's own
// constructor error surface as an unhandled 500 with no context.
export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set — AI floor-plan extraction is not configured.");
  }
  return new Anthropic({ apiKey });
}
