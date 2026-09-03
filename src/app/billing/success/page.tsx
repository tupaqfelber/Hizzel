import Link from "next/link";

export default function BillingSuccessPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-linen px-8 text-center">
      <h1 className="font-serif text-2xl text-linen-ink">You&rsquo;re all set</h1>
      <p className="max-w-xs text-sm text-linen-ink-secondary">
        Hizzel is unlocking now — this can take a few seconds to reflect. Head back in and
        start placing rooms.
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
