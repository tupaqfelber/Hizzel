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

  // Beat 0 (0-0.8s): the plain split-screen, empty — nothing overlaid yet.
  // A beat needs to actually land here before My Hizzel opens, rather than
  // jump-cutting straight to an already-open overlay. Shorter than the
  // flash-to-open gap right after it — this one's just "the app, sitting
  // there" for a moment, not a beat that needs to register on its own.
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

  // Beat 1 (0.8-1.6s): "My Hizzel" flashes — the same useFlashStore pulse
  // a real placement gets — as if it's just been tapped. A deliberately
  // fuller pause after the flash (roughly its own 0.7s duration) before
  // the overlay actually opens, rather than cutting in mid-flash.
  at(800, () => useFlashStore.getState().flash(DEMO_MY_HIZZEL_FLASH_ID));
  at(1600, () => patch({ overlayOpen: true }));

  // Beat 2 (2.2-3.1s): the two homes populate in, one at a time.
  at(2200, () => patch({ move: { ...DEMO_MOVE_BASE, properties: [DEMO_PROPERTIES[0]] } }));
  at(3100, () => patch({ move: { ...DEMO_MOVE_BASE, properties: DEMO_PROPERTIES } }));

  // Beat 3 (4-8s): overlay closes to reveal Things, which populates
  // one item at a time across the full 4s.
  at(4000, () => patch({ overlayOpen: false }));
  DEMO_THINGS.forEach((thing, i) => {
    at(4100 + i * 380, () => {
      revealedIds.add(thing.id);
      patch(buildThingsSnapshot(revealedIds, placedIds));
    });
  });

  // Beat 4 (8-10s): the Houseplan icon flies into the Plan button, which
  // flashes the instant it lands.
  at(8000, () => patch({ planIconVisible: true }));
  at(10000, () => {
    patch({ planIconVisible: false });
    useFlashStore.getState().flash(DEMO_PLAN_BUTTON_FLASH_ID);
  });

  // Beat 5 (10-13s): rooms materialise, one at a time, as if just
  // extracted from that plan.
  DEMO_ROOMS.forEach((_room, i) => {
    at(10000 + i * 700, () => patch({ areas: [DEMO_AREA], rooms: DEMO_ROOMS.slice(0, i + 1) }));
  });

  // Beat 6 (13-19s): furniture places itself into its room, staggered
  // across the full 6s. Moving Box (absent from DEMO_PLACEMENT_ORDER)
  // never places — it stays in Unassigned, deliberately.
  DEMO_PLACEMENT_ORDER.forEach((thingId, i) => {
    at(13000 + i * 650, () => {
      placedIds.add(thingId);
      patch(buildThingsSnapshot(revealedIds, placedIds));
    });
  });

  // Beat 7 (19-24s): My Hizzel reopens, Share flashes then "taps" itself
  // (my-hizzel-overlay.tsx's own effect reacts to pdfRequested and calls
  // its real handleShare()) — demo-pdf-reveal.tsx then owns the
  // full-screen, page-through-then-hold sequence entirely on its own once
  // the blob arrives, so finish is timed to sit comfortably after that
  // plays out (fetch latency + two ~1.4s page holds + a crossfade), not
  // tied to it directly.
  at(19000, () => patch({ overlayOpen: true }));
  at(19600, () => useFlashStore.getState().flash(DEMO_SHARE_BUTTON_FLASH_ID));
  at(19900, () => patch({ pdfRequested: true }));
  at(24000, onFinish);

  return () => timers.forEach(clearTimeout);
}
