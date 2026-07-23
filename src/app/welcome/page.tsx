"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function WelcomePage() {
  const router = useRouter();
  const supabase = createClient();
  const [continuing, setContinuing] = useState(false);

  async function handleContinue() {
    if (continuing) return;
    setContinuing(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id);
    }
    router.push("/");
  }

  return (
    <button
      type="button"
      onClick={handleContinue}
      className="flex min-h-dvh w-full flex-col items-center bg-[linear-gradient(160deg,#A87238_0%,#9A6630_30%,#8A5A28_70%,#7A4E20_100%)] text-left"
    >
      <div className="min-h-0 flex flex-1 flex-col items-center justify-center overflow-y-auto px-9 py-10 text-center">
        <div className="mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-[18px] bg-amber-ink shadow-[0_3px_12px_rgba(26,24,20,0.18)]">
          <Image src="/logo.png" alt="" width={50} height={50} className="rounded-lg" />
        </div>
        <p className="mb-3.5 text-[11px] font-medium uppercase tracking-[0.14em] text-amber-ink/55">
          Welcome to Hizzel
        </p>
        <h1 className="mb-6 font-serif text-[27px] leading-[1.15] tracking-[-0.4px] text-amber-ink">
          A calmer, more fun
          <br />
          way to move home
        </h1>
        <p className="mb-4.5 font-display-italic text-[15px] italic leading-[1.7] text-amber-ink/[.88]">
          Have a play moving our things from{" "}
          <b className="font-medium not-italic text-amber-ink">Hizzel Now</b> to{" "}
          <b className="font-medium not-italic text-amber-ink">Hizzel New</b> —
          drag the things into rooms and see how it all fits. Click on any item
          to see it or change it, and share with anyone on your team.
        </p>
        <p className="mb-4.5 font-display-italic text-[15px] italic leading-[1.7] text-amber-ink/[.88]">
          When you&rsquo;re done playing, press the{" "}
          <span className="mx-[3px] inline-flex h-7 w-7 items-center justify-center rounded-[7px] bg-amber-ink p-[3px] align-middle shadow-[0_2px_8px_rgba(26,24,20,0.15)]">
            <Image src="/logo.png" alt="" width={22} height={22} className="rounded" />
          </span>{" "}
          at the top to set up your first house move.
        </p>
        <p className="font-display-italic text-[15px] italic leading-[1.7] text-amber-ink/[.88]">
          Good luck with this next chapter, and let us know if there&rsquo;s
          any way Hizzel could be even more help for house moving.
        </p>
      </div>
      <div className="px-9 pb-12">
        <p className="flex items-center justify-center gap-1 font-display-italic text-base italic text-amber-ink">
          Press{" "}
          <span className="mx-[3px] inline-flex h-7 w-7 items-center justify-center rounded-[7px] bg-amber-ink p-[3px] align-middle shadow-[0_2px_8px_rgba(26,24,20,0.15)]">
            <Image src="/logo.png" alt="" width={22} height={22} className="rounded" />
          </span>{" "}
          at top of screen to start playing
        </p>
      </div>
    </button>
  );
}
