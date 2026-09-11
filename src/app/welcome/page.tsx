"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DESKTOP_BREAKPOINT_PX } from "@/components/app-shell";

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
  // rendering into a normal wide-short box either way. Desktop (>=1024px,
  // same breakpoint AppShell uses) gets its own larger-scale layout
  // instead — a real desktop window is never worth forcing into this
  // rotation trick.
  const [isPhysicallyPortrait, setIsPhysicallyPortrait] = useState(false);
  const [isDesktopWidth, setIsDesktopWidth] = useState(false);

  useEffect(() => {
    function update() {
      setIsPhysicallyPortrait(window.innerWidth <= window.innerHeight);
      setIsDesktopWidth(window.innerWidth >= DESKTOP_BREAKPOINT_PX);
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

  function handleWatchDemo() {
    router.push("/welcome/demo");
  }

  const bodyCopy = (
    <>
      <p className="mb-2.5 font-display-italic text-[13.5px] italic leading-[1.5] text-amber-ink/[.85] lg:mb-3 lg:text-[14.5px] lg:leading-[1.55]">
        First have a play. Move things from{" "}
        <b className="font-semibold not-italic text-amber-ink">Hizzel Now</b> to{" "}
        <b className="font-semibold not-italic text-amber-ink">Hizzel New</b>. Drag
        furniture into rooms and see how it all fits. Click on anything to see or
        change details. Move the rooms around and lock when you&rsquo;re happy.
      </p>
      <p className="mb-2.5 font-display-italic text-[13.5px] italic leading-[1.5] text-amber-ink/[.85] lg:mb-3 lg:text-[14.5px] lg:leading-[1.55]">
        When you&rsquo;re ready, go to{" "}
        <b className="font-semibold not-italic text-amber-ink">My Hizzel</b>{" "}
        and start visualising your new home. Add all your own things. Upload your
        floor plans or type in your rooms, and start your house move today. When
        you&rsquo;ve decided where it all goes, share the plan with friends, family
        or anyone helping you on the big move day.
      </p>
      <p className="font-display-italic text-[13.5px] italic leading-[1.5] text-amber-ink/[.85] lg:text-[14.5px] lg:leading-[1.55]">
        Good luck with this next chapter, and let us know if there&rsquo;s any way
        Hizzel could be even more help for house moving.
      </p>
    </>
  );

  const ctaRow = (gapClassName: string) => (
    <div className={`flex shrink-0 items-center justify-center ${gapClassName}`}>
      <button
        type="button"
        onClick={handleWatchDemo}
        className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-amber-ink/50 bg-transparent px-6 py-[9px] font-serif text-sm text-amber-ink lg:px-8 lg:py-[13px] lg:text-base"
      >
        Watch demo
      </button>
      <button
        type="button"
        onClick={handleContinue}
        disabled={continuing}
        className="inline-flex items-center gap-2 rounded-full bg-amber-ink px-6 py-2.5 font-serif text-sm text-[#5C3A18] shadow-[0_4px_16px_rgba(26,24,20,0.22)] disabled:opacity-60 lg:px-8 lg:py-[14px] lg:text-base"
      >
        {continuing ? "One moment…" : "Let's begin"}
      </button>
    </div>
  );

  if (isDesktopWidth) {
    return (
      <div className="flex h-dvh w-dvw items-center justify-center bg-[#7A4E20] p-8">
        <div className="flex h-[720px] w-[1200px] max-w-full flex-col items-center bg-[linear-gradient(160deg,#A87238_0%,#9A6630_30%,#8A5A28_70%,#7A4E20_100%)] px-12 py-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="mb-2.5 flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-[17px] bg-amber-ink shadow-[0_4px_18px_rgba(26,24,20,0.2)]">
            <Image src="/logo.png" alt="" width={45} height={45} className="rounded-lg" />
          </div>
          <p className="mb-2.5 shrink-0 text-[13px] font-medium uppercase tracking-[0.14em] text-amber-ink/55">
            Welcome to Hizzel
          </p>
          <h1 className="mb-5 max-w-[660px] shrink-0 font-serif text-[26px] leading-[1.25] tracking-[-0.4px] text-amber-ink">
            Take control, for a calmer, more fun way to move home.
          </h1>
          <div className="max-w-[700px]">{bodyCopy}</div>
          <div className="pt-[22px]">{ctaRow("gap-4")}</div>
        </div>
      </div>
    );
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

      <div className="min-h-0 max-w-[680px] flex-1 overflow-y-auto pr-1">{bodyCopy}</div>

      <div className="pt-7">{ctaRow("gap-3")}</div>
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
