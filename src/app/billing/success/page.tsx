"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { trackPurchaseConversion } from "@/lib/gtag";

// Google Ads "Purchase" conversion (Performance Max campaign) — fires
// once, here, using the real amount/currency from Stripe (via
// /api/stripe/session-info, since this page's own URL only has the
// checkout session_id) rather than a guessed/flat value. Never fires for
// a free Trial redemption (amountTotal === 0) — that's already covered
// by the separate "Sign Up" conversion, and counting a £0 checkout here
// would dilute the actual revenue signal. See src/lib/gtag.ts.
function PurchaseConversionTracker() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  // Guards against firing twice for the same session (e.g. a refresh of
  // this page) — sessionStorage survives a refresh but not a new tab/
  // visit, which is exactly the "once per real purchase" behaviour
  // wanted here.
  const firedRef = useRef(false);

  useEffect(() => {
    if (!sessionId || firedRef.current) return;
    const storageKey = `hizzel_purchase_tracked_${sessionId}`;
    if (sessionStorage.getItem(storageKey)) return;

    firedRef.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/stripe/session-info?session_id=${encodeURIComponent(sessionId)}`);
        if (!res.ok) return;
        const { product, amountTotal, currency } = await res.json();
        if (product === "trial" || !amountTotal || !currency) return;
        trackPurchaseConversion({
          value: amountTotal / 100,
          currency: currency.toUpperCase(),
          transactionId: sessionId,
        });
        sessionStorage.setItem(storageKey, "1");
      } catch (err) {
        console.error("Couldn't record the Purchase conversion", err);
      }
    })();
  }, [sessionId]);

  return null;
}

export default function BillingSuccessPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-linen px-8 text-center">
      {/* Suspense boundary is required around useSearchParams in the App
          Router — without it, this page can't be statically rendered. */}
      <Suspense fallback={null}>
        <PurchaseConversionTracker />
      </Suspense>
      <h1 className="font-serif text-2xl text-linen-ink">You&rsquo;re all set</h1>
      <p className="max-w-xs text-sm text-linen-ink-secondary">
        Your new Hizzel plan is unlocking now. This can take a few seconds. Head back in
        and start planning the move to your new home.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-xl bg-linen-ink px-6 py-3 text-sm font-medium text-linen"
      >
        Back to Hizzel
      </Link>
    </div>
  );
}
