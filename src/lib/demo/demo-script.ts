// The demo's actual timeline — pure logic, no React. Mirrors app-shell.tsx's
// own animateTo: driven by setTimeout, not requestAnimationFrame, for the
// same reason (rAF/CSS timers get suspended when the tab loses focus,
// which would leave the sequence stuck mid-beat rather than just running
// a little late).
import { UNASSIGNED, type ThingGroup } from "@/hooks/use-things";
import type { MoveItem } from "@/hooks/use-move-items";
import { useFlashStore } from "@/hooks/use-flash-store";
import {
  DEMO_AREA,
  DEMO_MOVE_BASE,
  DEMO_MY_HIZZEL_FLASH_ID,
  DEMO_NEW_MOVE_FLASH_ID,
  DEMO_PLACEMENT_ORDER,
  DEMO_PLAN_BUTTON_FLASH_ID,
  DEMO_PROPERTIES,
  DEMO_ROOMS,
  DEMO_SHARE_BUTTON_FLASH_ID,
  DEMO_THINGS,
  type DemoRoomKey,
} from "@/lib/demo/demo-data";

function roomIdForKey(key: DemoRoomKey | null): string | null {
  if (!key) return null;
  return DEMO_ROOMS.find((r) => r.key === key)?.id ?? null;
}

// Rebuilds both the grouped-by-room shape (useGroupedThings) and the flat
// placement shape (useMoveItems) from the same two sets, so Things and
// Hizzel's canvas are always looking at one consistent picture of "what's
// been revealed so far" and "what's been placed so far" — never two
// snapshots that could disagree.
function buildThingsSnapshot(revealedIds: Set<string>, placedIds: Set<string>) {
  const revealed = DEMO_THINGS.filter((t) => revealedIds.has(t.id));

  const moveItems: MoveItem[] = revealed.map((t) => {
    const isPlaced = placedIds.has(t.id);
    return {
      id: t.id,
      name: t.name,
      category: t.category,
      width_cm: t.width_cm,
      depth_cm: t.depth_cm,
      height_cm: t.height_cm,
      photo_url: t.photo_url,
      notes: null,
      roomId: isPlaced ? roomIdForKey(t.roomKey) : null,
      x_cm: isPlaced ? t.placement.x_cm : null,
      y_cm: isPlaced ? t.placement.y_cm : null,
      rotation_deg: isPlaced ? t.placement.rotation_deg : 0,
      inTray: false,
    };
  });

  const groupsByKey = new Map<string, ThingGroup>();
  if (revealed.length > 0) {
    groupsByKey.set(UNASSIGNED, {
      key: UNASSIGNED,
      roomName: UNASSIGNED,
      areaName: null,
      areaSortOrder: 0,
      roomWidthCm: null,
      roomDepthCm: null,
      items: [],
    });
  }
  for (const t of revealed) {
    const isPlaced = placedIds.has(t.id);
    const room = isPlaced && t.roomKey ? DEMO_ROOMS.find((r) => r.key === t.roomKey) : undefined;
    const key = room?.id ?? UNASSIGNED;
    if (!groupsByKey.has(key)) {
      groupsByKey.set(key, {
        key,
        roomName: room?.name ?? UNASSIGNED,
        areaName: room ? DEMO_AREA.name : null,
        areaSortOrder: 0,
        roomWidthCm: room?.width_cm ?? null,
        roomDepthCm: room?.depth_cm ?? null,
        items: [],
      });
    }
    groupsByKey.get(key)!.items.push({
      id: t.id,
      name: t.name,
      category: t.category,
      width_cm: t.width_cm,
      depth_cm: t.depth_cm,
      height_cm: t.height_cm,
      photo_url: t.photo_url,
      notes: null,
      roomId: room?.id ?? null,
    });
  }

  // Same sort as useGroupedThings: Unassigned leads (the to-do pile), then
  // alphabetically — the reversed-for-print sort lives only in the demo
  // PDF route, matching how the real app and the real PDF route diverge.
  const groups = [...groupsByKey.values()].sort((a, b) => {
    if (a.roomName === UNASSIGNED) return -1;
    if (b.roomName === UNASSIGNED) return 1;
    return a.roomName.localeCompare(b.roomName);
  });

  return { groups, totalCount: revealed.length, moveItems };
}

export interface DemoPatch {
  move?: { properties: typeof DEMO_PROPERTIES } & typeof DEMO_MOVE_BASE;
  groups?: ThingGroup[];
  totalCount?: number;
  moveItems?: MoveItem[];
  areas?: typeof DEMO_AREA[];
  rooms?: typeof DEMO_ROOMS;
  overlayOpen?: boolean;
  planIconVisible?: boolean;
  pdfRequested?: boolean;
  pdfUrl?: string | null;
}

export function runDemoScript(patch: (p: DemoPatch) => void, onFinish: () => void): () => void {
  const revealedIds = new Set<string>();
  const placedIds = new Set<string>();
  const timers: ReturnType<typeof setTimeout>[] = [];
  const at = (ms: number, run: () => void) => timers.push(setTimeout(run, ms));

  // Beat 0 (0-0.5s): the plain split-screen, empty — nothing overlaid yet.
  // A beat needs to actually land here before My Hizzel opens, rather than
  // jump-cutting straight to an already-open overlay.
  patch({
    move: { ...DEMO_MOVE_BASE, properties: [] },
    ...buildThingsSnapshot(revealedIds, placedIds),
    areas: [],
    rooms: [],
    overlayOpen: false,
    planIconVisible: false,
    pdfRequested: false,
    pdfUrl: null,
  });

  // Every simulated tap flashes at DEMO_FLASH_MS (double the size + hold
  // of the real .animate-item-flash a genuine placement gets — see
  // globals.css's .animate-demo-flash) — a passive viewer needs a much
  // more noticeable cue than an active user does for their own tap.
  const DEMO_FLASH_MS = 1400;

  // Beat 1 (0.5-1.9s): "My Hizzel" flashes — as if it's just been tapped.
  // The overlay only opens once the full flash has played out, not mid-
  // animation — opening it sooner would cover (and visually cut off) the
  // button while it's still flashing.
  at(500, () => useFlashStore.getState().flash(DEMO_MY_HIZZEL_FLASH_ID, DEMO_FLASH_MS));
  at(500 + DEMO_FLASH_MS, () => patch({ overlayOpen: true }));

  // Beat 2 (1.9-2.7s): the overlay sits empty for a beat (no homes yet),
  // then "+ New move" flashes — held for 800ms, same as beat 4/6-style
  // gaps elsewhere (kept independent of beat 0's own hold above, which
  // is its own separate, now-shorter pre-roll). This button isn't
  // covered by anything afterward, so — unlike My Hizzel above — the
  // next beat doesn't need to wait out the full flash duration.
  at(1900 + 800, () => useFlashStore.getState().flash(DEMO_NEW_MOVE_FLASH_ID, DEMO_FLASH_MS));

  // Beat 3 (3.4-4.3s): the two homes populate in, one at a time.
  at(3400, () => patch({ move: { ...DEMO_MOVE_BASE, properties: [DEMO_PROPERTIES[0]] } }));
  at(4300, () => patch({ move: { ...DEMO_MOVE_BASE, properties: DEMO_PROPERTIES } }));

  // Beat 4 (5.2-9.2s): overlay closes to reveal Things, which populates
  // one item at a time across the full 4s.
  at(5200, () => patch({ overlayOpen: false }));
  DEMO_THINGS.forEach((thing, i) => {
    at(5300 + i * 380, () => {
      revealedIds.add(thing.id);
      patch(buildThingsSnapshot(revealedIds, placedIds));
    });
  });

  // Beat 5 (9.2-11.2s): the Houseplan icon flies into the Plan button,
  // which flashes the instant it lands (also not covered by anything
  // right after, same reasoning as "+ New move" above).
  at(9200, () => patch({ planIconVisible: true }));
  at(11200, () => {
    patch({ planIconVisible: false });
    useFlashStore.getState().flash(DEMO_PLAN_BUTTON_FLASH_ID, DEMO_FLASH_MS);
  });

  // Beat 6 (11.2-14.2s): rooms materialise, one at a time, as if just
  // extracted from that plan.
  DEMO_ROOMS.forEach((_room, i) => {
    at(11200 + i * 700, () => patch({ areas: [DEMO_AREA], rooms: DEMO_ROOMS.slice(0, i + 1) }));
  });

  // Beat 7 (14.2-20.2s): furniture places itself into its room, staggered
  // across the full 6s. Moving Box (absent from DEMO_PLACEMENT_ORDER)
  // never places — it stays in Unassigned, deliberately.
  DEMO_PLACEMENT_ORDER.forEach((thingId, i) => {
    at(14200 + i * 650, () => {
      placedIds.add(thingId);
      patch(buildThingsSnapshot(revealedIds, placedIds));
    });
  });

  // Beat 8 (20.1-26.2s): My Hizzel reopens, Share flashes then "taps"
  // itself (my-hizzel-overlay.tsx's own effect reacts to pdfRequested and
  // calls its real handleShare()) once the flash has fully played out —
  // the incoming PDF reveal would otherwise cover (and cut off) Share
  // mid-flash, same reasoning as beat 1's My Hizzel/overlay gap.
  // demo-pdf-reveal.tsx then owns the pop-out-and-hold sequence entirely
  // on its own once the blob arrives, so finish is timed to sit
  // comfortably after that plays out (fetch latency + its own ~700ms
  // grow + 3s hold).
  at(20100, () => patch({ overlayOpen: true }));
  at(20700, () => useFlashStore.getState().flash(DEMO_SHARE_BUTTON_FLASH_ID, DEMO_FLASH_MS));
  at(20700 + DEMO_FLASH_MS, () => patch({ pdfRequested: true }));
  at(26200, onFinish);

  return () => timers.forEach(clearTimeout);
}
