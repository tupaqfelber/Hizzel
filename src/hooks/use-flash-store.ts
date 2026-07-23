import { create } from "zustand";

// Brief highlight for items that just bounced back to the tray — a
// rejected placement (didn't fit) or a bystander that couldn't be pushed
// clear of a drop. Global rather than component state because the trigger
// can come from either world (Hizzel's own in-canvas drag, or a
// cross-world drag started from a Things card), while the tray itself is
// only ever rendered by HizzelWorld.
const FLASH_DURATION_MS = 700;

interface FlashStore {
  flashingIds: Set<string>;
  flash: (id: string) => void;
}

export const useFlashStore = create<FlashStore>((set) => ({
  flashingIds: new Set(),
  flash: (id) => {
    set((state) => ({ flashingIds: new Set(state.flashingIds).add(id) }));
    setTimeout(() => {
      set((state) => {
        const next = new Set(state.flashingIds);
        next.delete(id);
        return { flashingIds: next };
      });
    }, FLASH_DURATION_MS);
  },
}));
