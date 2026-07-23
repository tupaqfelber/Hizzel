"use client";

import { IconX } from "@tabler/icons-react";
import { IconButton } from "@/components/ui/icon-button";

// The master input pattern: every add/edit form in the app (Thing, Room, Area,
// Property, Move) slides up as one of these. Build once, reuse everywhere.

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <div
        className="absolute inset-0 bg-linen-ink/25 lg:bg-black/45"
        onClick={onClose}
        aria-hidden
      />
      <div className="animate-panel-rise relative flex max-h-[calc(100%-90px)] w-full max-w-[500px] flex-col overflow-hidden rounded-t-[26px] bg-linen shadow-[0_-8px_40px_rgba(26,24,20,0.18)] lg:w-[440px] lg:max-w-[440px] lg:max-h-[88vh] lg:rounded-[26px]">
        <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-linen-border lg:hidden" />
        <div className="flex shrink-0 items-center justify-between px-[22px] pt-3.5 pb-1.5">
          <h2 className="font-serif text-[21px] text-linen-ink">{title}</h2>
          <IconButton icon={IconX} label="Close" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

export function SheetBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pt-1.5 pb-5">
      {children}
    </div>
  );
}

export function SheetFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 gap-2.5 border-t border-[#E4E0D8] px-[22px] pt-3 pb-6">
      {children}
    </div>
  );
}
