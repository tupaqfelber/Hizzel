import { create } from "zustand";
import type { CurrentMove } from "@/hooks/use-current-move";
import type { Area } from "@/hooks/use-areas";
import type { RoomRow } from "@/hooks/use-rooms";
import type { ThingGroup } from "@/hooks/use-things";
import type { MoveItem } from "@/hooks/use-move-items";

// Global "is the Watch-demo playback active, and what does the world look
// like right now" state — the single seam every patched data hook
// (use-current-move.ts, use-things.ts, use-areas.ts, use-rooms.ts,
// use-move-items.ts, use-billing-status.ts) checks before deciding whether
// to return its real Supabase-backed query or this scripted snapshot
// instead. Same pattern as use-paywall-store.ts: plain zustand, read
// imperatively or via selectors, no prop-drilling needed from
// src/components/demo/demo-player.tsx (which owns the actual timeline)
// down into components several levels away.
interface DemoSnapshot {
  move: CurrentMove | null;
  groups: ThingGroup[];
  totalCount: number;
  areas: Area[];
  rooms: RoomRow[];
  moveItems: MoveItem[];
  // My Hizzel overlay open/closed, driven by the script (beats 1, 2, 7)
  // rather than a tap — AppShell reads this while a demo is active.
  overlayOpen: boolean;
  // Beat 4's "Houseplan" icon flourish — see demo-plan-icon.tsx.
  planIconVisible: boolean;
  // Beat 7: set true once the script wants "Share" to fire. Read by
  // my-hizzel-overlay.tsx's own effect, which then calls its real
  // handleShare() — one code path generates the PDF either way, just
  // triggered by this flag instead of a tap during playback.
  pdfRequested: boolean;
}

interface DemoStore extends DemoSnapshot {
  active: boolean;
  start: () => void;
  finish: () => void;
  patch: (partial: Partial<DemoSnapshot>) => void;
}

const EMPTY_SNAPSHOT: DemoSnapshot = {
  move: null,
  groups: [],
  totalCount: 0,
  areas: [],
  rooms: [],
  moveItems: [],
  overlayOpen: false,
  planIconVisible: false,
  pdfRequested: false,
};

export const useDemoStore = create<DemoStore>((set) => ({
  active: false,
  ...EMPTY_SNAPSHOT,
  start: () => set({ active: true, ...EMPTY_SNAPSHOT }),
  // Used both when the script finishes naturally and when the viewer
  // skips — either way playback stops and every patched hook falls back
  // to its real query again on the very next render.
  finish: () => set({ active: false, ...EMPTY_SNAPSHOT }),
  patch: (partial) => set(partial),
}));
