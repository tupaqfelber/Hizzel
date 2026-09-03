import { create } from "zustand";

// The mirror of useScrollToItemStore, in the opposite direction: dropping
// a Things card into a room should select that same item in Hizzel's own
// toolbar (with its usual flash), exactly as if it had been tapped there
// directly — otherwise the top bar still shows whatever was selected
// before (or nothing), even though the item you just placed is the one
// that matters. Its own store rather than reusing useFlashStore for the
// same reason: selecting is a distinct action from flashing, and other
// flash triggers (a bounce back to the tray, a bumped neighbour) must not
// also steal the toolbar's selection.
interface SelectItemStore {
  itemId: string | null;
  nonce: number;
  requestSelect: (id: string) => void;
}

export const useSelectItemStore = create<SelectItemStore>((set) => ({
  itemId: null,
  nonce: 0,
  requestSelect: (id) => set((state) => ({ itemId: id, nonce: state.nonce + 1 })),
}));
