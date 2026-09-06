"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { IconMail, IconKey } from "@tabler/icons-react";
import { usePostHog } from "posthog-js/react";
import { createClient } from "@/lib/supabase/client";
import { useAutoFocus } from "@/hooks/use-auto-focus";

type Step = "email" | "code";

// For any 5xx-class response, the Supabase JS SDK treats it as a
// retryable infrastructure error rather than an application error with a
// real message — its own error-message fallback then does
// JSON.stringify() on the raw fetch Response object, which produces the
// literal (and useless) string "{}", not the actual server-side reason.
// Rather than show that verbatim, fall back to something a user can
// actually read; the real reason (rate limiting, SMTP misconfig, an
// actual outage) still needs checking server-side, just not from this.
function readableAuthError(message: string): string {
  if (message === "{}") {
    return "Something went wrong sending that. Please try again in a moment.";
  }
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const posthog = usePostHog();

  const [step, setStep] = useState<Step>("email");
  const emailInputRef = useAutoFocus<HTMLInputElement>();
  const codeInputRef = useAutoFocus<HTMLInputElement>();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) {
      setError(readableAuthError(error.message));
      return;
    }
    setStep("code");
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setLoading(false);
    if (error) {
      setError(readableAuthError(error.message));
      return;
    }
    if (data.user) posthog?.identify(data.user.id, { email: data.user.email });
    router.push("/welcome");
  }

  return (
    <div className="flex min-h-dvh flex-col overflow-y-auto bg-linen px-10">
      <div className="flex w-full max-w-xs flex-1 shrink-0 flex-col items-center justify-center self-center py-8">
        <Image
          src="/logo.png"
          alt=""
          width={64}
          height={64}
          className="mb-6 mix-blend-multiply"
          priority
        />
        <h1 className="mb-2 font-serif text-[34px] tracking-[-0.5px] text-linen-ink">
          Hizzel
        </h1>
        <p className="mb-12 text-center text-[13px] leading-[1.5] text-linen-ink-tertiary">
          Your things. Your homes.
          <br />
          Your moves, Made simple.
        </p>

        {step === "email" ? (
          <form onSubmit={handleSendCode} className="w-full">
            <label
              htmlFor="email"
              className="mb-2 block self-start text-[10px] font-medium uppercase tracking-[0.1em] text-linen-ink-tertiary"
            >
              Email
            </label>
            <div className="mb-4 flex items-center gap-2.5 rounded-sm bg-linen-field px-4 py-3.5">
              <IconMail size={16} className="text-linen-ink-tertiary" />
              <input
                ref={emailInputRef}
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full bg-transparent text-sm text-linen-ink placeholder:text-[#B0A898] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mb-5 w-full rounded-sm bg-linen-ink py-[15px] text-center text-sm font-medium text-linen disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send me a code"}
            </button>
            {error && (
              <p className="mb-3 text-center text-[11px] text-red-700">
                {error}
              </p>
            )}
            <p className="text-center text-[11px] leading-[1.6] text-[#B0A898]">
              We&rsquo;ll email you a one-time code.
              <br />
              No password needed.
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="w-full">
            <label
              htmlFor="code"
              className="mb-2 block self-start text-[10px] font-medium uppercase tracking-[0.1em] text-linen-ink-tertiary"
            >
              Code
            </label>
            <div className="mb-4 flex items-center gap-2.5 rounded-sm bg-linen-field px-4 py-3.5">
              <IconKey size={16} className="text-linen-ink-tertiary" />
              <input
                ref={codeInputRef}
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="12345678"
                maxLength={8}
                className="w-full bg-transparent text-sm tracking-[0.2em] text-linen-ink placeholder:text-[#B0A898] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mb-5 w-full rounded-sm bg-linen-ink py-[15px] text-center text-sm font-medium text-linen disabled:opacity-60"
            >
              {loading ? "Verifying…" : "Verify code"}
            </button>
            {error && (
              <p className="mb-3 text-center text-[11px] text-red-700">
                {error}
              </p>
            )}
            <p className="text-center text-[11px] leading-[1.6] text-[#B0A898]">
              Sent to {email}.{" "}
              <button
                type="button"
                onClick={() => setStep("email")}
                className="underline"
              >
                Use a different email
              </button>
            </p>
          </form>
        )}
      </div>

      <p className="shrink-0 px-10 pb-8 text-center text-[10px] leading-[1.6] text-[#C4BFB3]">
        By continuing you agree to our Terms &amp; Privacy Policy
      </p>
    </div>
  );
}
