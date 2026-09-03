import { create } from "zustand";

// Global open/close for the shared paywall Sheet — same pattern as
// use-flash-store.ts, so any gate point across hizzel-world.tsx,
// hizzel-mid-panel.tsx, things-world.tsx, and room-block.tsx can trigger it
// imperatively via usePaywallStore.getState().open() without prop-drilling.
interface PaywallStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const usePaywallStore = create<PaywallStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
