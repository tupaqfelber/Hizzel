// Google Ads conversion tracking — the base gtag.js loader lives in
// src/app/layout.tsx (site-wide, next/script). These are the two actual
// conversion actions created in the Google Ads account for the
// Performance Max campaign:
//   - Sign Up: fires once, the first time someone completes onboarding
//     (welcome/page.tsx's handleContinue, demo-player.tsx's handleBegin)
//     — a "One per click" lead-style goal, no value.
//   - Purchase: fires on a real paid Pass/Annual purchase (never the
//     free Trial — that's already covered by Sign Up, and counting a
//     £0 checkout here would dilute the actual revenue signal) — an
//     "Every" purchase-style goal, with the real amount so Google can
//     optimise toward revenue rather than just conversion count.
const SIGN_UP_SEND_TO = "AW-18451639556/8F44COqC-vgcEITatt5E";
const PURCHASE_SEND_TO = "AW-18451639556/QBPUCOyi-vgcEITatt5E";

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
  }
}

// Defensive against gtag.js failing to load at all (blocked by an ad
// blocker, network hiccup, etc.) — conversion tracking should never be
// able to break the actual signup/purchase flow it's just observing.
function safeGtag(...args: unknown[]) {
  try {
    window.gtag?.(...args);
  } catch (err) {
    console.error("gtag call failed", err);
  }
}

export function trackSignUpConversion() {
  safeGtag("event", "conversion", { send_to: SIGN_UP_SEND_TO });
}

export function trackPurchaseConversion(params: {
  value: number;
  currency: string;
  transactionId: string;
}) {
  safeGtag("event", "conversion", {
    send_to: PURCHASE_SEND_TO,
    value: params.value,
    currency: params.currency,
    transaction_id: params.transactionId,
  });
}
