import { create } from "zustand";

// A one-off "scroll to this item" signal, fired when an item is
// tap-selected in Hizzel's canvas so Things world can bring the same
// item's card into view there too. Deliberately its own store rather than
// piggybacking on useFlashStore's flashingIds: that set fires for every
// confirmation across the app (a placement landing, a bounce back to the
// tray, a bumped neighbour) and reacting to all of those would scroll the
// Things list around for reasons that have nothing to do with a deliberate
// selection. `nonce` guarantees a re-request for the *same* item (tapping
// it again after scrolling away) still notifies subscribers — a Zustand
// set to an unchanged itemId string wouldn't otherwise be seen as a change.
interface ScrollToItemStore {
  itemId: string | null;
  nonce: number;
  requestScroll: (id: string) => void;
}

export const useScrollToItemStore = create<ScrollToItemStore>((set) => ({
  itemId: null,
  nonce: 0,
  requestScroll: (id) => set((state) => ({ itemId: id, nonce: state.nonce + 1 })),
}));
