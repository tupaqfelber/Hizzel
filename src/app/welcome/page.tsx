"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function WelcomePage() {
  const router = useRouter();
  const supabase = createClient();
  const [continuing, setContinuing] = useState(false);
  // Welcome always renders landscape, regardless of how the phone is
  // actually being held — rather than asking a brand-new user to
  // physically rotate their phone for their very first screen, a portrait
  // hold gets the exact same content visually rotated 90° via CSS to fill
  // the (now sideways) viewport, no different from a landscape hold. This
  // is the standard "forced landscape" technique: a wrapper sized to the
  // *rotated* dimensions (100vh wide, 100vw tall) rotated -90° around its
  // top-left corner, so from the content's own perspective it's simply
  // rendering into a normal wide-short box either way.
  const [isPhysicallyPortrait, setIsPhysicallyPortrait] = useState(false);

  useEffect(() => {
    function update() {
      setIsPhysicallyPortrait(window.innerWidth <= window.innerHeight);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

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

  const content = (
    <div className="flex h-full w-full flex-col items-center bg-[linear-gradient(160deg,#A87238_0%,#9A6630_30%,#8A5A28_70%,#7A4E20_100%)] px-10 py-5 text-center">
      <div className="mb-2.5 flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[15px] bg-amber-ink shadow-[0_3px_12px_rgba(26,24,20,0.18)]">
        <Image src="/logo.png" alt="" width={38} height={38} className="rounded-lg" />
      </div>
      <p className="mb-[5px] shrink-0 text-[10px] font-medium uppercase tracking-[0.12em] text-amber-ink/55">
        Welcome to Hizzel
      </p>
      <h1 className="mb-3 max-w-[520px] shrink-0 font-serif text-xl leading-[1.2] tracking-[-0.3px] text-amber-ink">
        Take control, for a calmer, more fun way to move home.
      </h1>

      <div className="min-h-0 max-w-[680px] flex-1 overflow-y-auto pr-1">
        <p className="mb-2.5 font-display-italic text-[13.5px] italic leading-[1.5] text-amber-ink/[.85]">
          First have a play. Move things from{" "}
          <b className="font-semibold not-italic text-amber-ink">Hizzel Now</b> to{" "}
          <b className="font-semibold not-italic text-amber-ink">Hizzel New</b>. Drag
          furniture into rooms and see how it all fits. Click on anything to see or
          change details. Move the rooms around and lock when you&rsquo;re happy.
        </p>
        <p className="mb-2.5 font-display-italic text-[13.5px] italic leading-[1.5] text-amber-ink/[.85]">
          When you&rsquo;re ready, go to{" "}
          <b className="font-semibold not-italic text-amber-ink">My Hizzel</b> and start
          visualising your new home. Add all your own things. Upload your floor plans or
          type in your rooms, and start your house move today. When you&rsquo;ve decided
          where it all goes, share the plan with any move-day helpers.
        </p>
        <p className="font-display-italic text-[13.5px] italic leading-[1.5] text-amber-ink/[.85]">
          Good luck with this next chapter, and let us know if there&rsquo;s any way
          Hizzel could be even more help for house moving.
        </p>
      </div>

      <div className="shrink-0 pt-7">
        <button
          type="button"
          onClick={handleContinue}
          disabled={continuing}
          className="inline-flex items-center gap-2 rounded-full bg-amber-ink px-6 py-2.5 font-serif text-sm text-[#5C3A18] shadow-[0_4px_16px_rgba(26,24,20,0.22)] disabled:opacity-60"
        >
          {continuing ? "One moment…" : "Let's begin"}
        </button>
      </div>
    </div>
  );

  if (!isPhysicallyPortrait) {
    return <div className="h-dvh w-dvw">{content}</div>;
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#7A4E20]">
      <div
        className="absolute left-0 top-full"
        style={{
          width: "100vh",
          height: "100vw",
          transform: "rotate(-90deg)",
          transformOrigin: "left top",
        }}
      >
        {content}
      </div>
    </div>
  );
}
