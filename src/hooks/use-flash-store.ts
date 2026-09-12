import { create } from "zustand";

// Brief highlight for an item that just landed somewhere — a successful
// placement into a room (confirmation) or a bounce back to the tray (a
// rejected placement that didn't fit, or a bystander that couldn't be
// pushed clear of a drop). Global rather than component state because the
// trigger can come from any of the three placement routes (Hizzel's own
// in-canvas drag, a cross-world drag from a Things card, or the Mid
// panel's magical thumbnail drop), while the flashing element itself is
// rendered by whichever component currently shows that item (tray card,
// full-canvas item block, or Mid's thumbnail/unassigned-list rows).
const FLASH_DURATION_MS = 700;

interface FlashStore {
  flashingIds: Set<string>;
  // durationMs is an override for callers using a different-length CSS
  // animation than the default (e.g. the Watch-demo sequence's own bigger,
  // longer "animate-demo-flash" — see globals.css) — defaults to the
  // standard 700ms real-placement confirmation everywhere else.
  flash: (id: string, durationMs?: number) => void;
}

export const useFlashStore = create<FlashStore>((set) => ({
  flashingIds: new Set(),
  flash: (id, durationMs = FLASH_DURATION_MS) => {
    set((state) => ({ flashingIds: new Set(state.flashingIds).add(id) }));
    setTimeout(() => {
      set((state) => {
        const next = new Set(state.flashingIds);
        next.delete(id);
        return { flashingIds: next };
      });
    }, durationMs);
  },
}));
