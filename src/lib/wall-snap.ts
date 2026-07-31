// Snapping and boundary rules for structural elements (doors/windows), which
// live on exactly one wall of a room as a 1-D span rather than a free 2-D
// footprint like items. `offset_cm` is measured from the wall's start corner:
// n/s walls run left→right along x, e/w walls run top→bottom along y (the
// same x-right/y-down room-local system RoomBlock and canvas-scale.ts use).
// A wall collision that can't be resolved by snapping is rejected outright —
// no push/cascade, unlike item-snap.ts — doors/windows are low-cardinality
// per wall so a hard reject is acceptable and far simpler.

import type { StructuralType, WallSide } from "@/lib/supabase/types";

const SNAP_THRESHOLD_CM = 15;
const OVERLAP_EPSILON_CM = 0.5;

export const STRUCTURAL_DEFAULT_WIDTH_CM: Record<StructuralType, number> = {
  door: 90,
  window: 120,
};

export interface PlacedStructural {
  id: string;
  wall_side: WallSide;
  offset_cm: number;
  width_cm: number;
}

export type WallSnapResult =
  | { fits: true; wall_side: WallSide; offset_cm: number }
  | { fits: false };

function wallLength(wallSide: WallSide, room: { width_cm: number; depth_cm: number }): number {
  return wallSide === "n" || wallSide === "s" ? room.width_cm : room.depth_cm;
}

// Every wall, nearest first, from a point clamped into the room — shared by
// the live preview (no fit check) and the commit path (which walks this list
// trying each wall until one actually fits).
function wallsByDistance(
  localXcm: number,
  localYcm: number,
  room: { width_cm: number; depth_cm: number },
): { wall_side: WallSide; along: number }[] {
  const x = Math.min(Math.max(localXcm, 0), room.width_cm);
  const y = Math.min(Math.max(localYcm, 0), room.depth_cm);

  return [
    { wall_side: "n" as WallSide, dist: y, along: x },
    { wall_side: "s" as WallSide, dist: room.depth_cm - y, along: x },
    { wall_side: "w" as WallSide, dist: x, along: y },
    { wall_side: "e" as WallSide, dist: room.width_cm - x, along: y },
  ].sort((a, b) => a.dist - b.dist);
}

function segmentsOverlap(aStart: number, aWidth: number, bStart: number, bWidth: number) {
  return (
    aStart < bStart + bWidth - OVERLAP_EPSILON_CM && aStart + aWidth > bStart + OVERLAP_EPSILON_CM
  );
}

// Wall + proposed offset already known (a form edit, or the second half of a
// drop) — snaps the offset to the wall's ends and to neighboring elements'
// edges on the same wall, then rejects if it still overlaps one or the
// element is simply too wide for the wall.
export function resolveWallPlacement(
  elementWidth: number,
  wallSide: WallSide,
  proposedOffset: number,
  room: { width_cm: number; depth_cm: number },
  others: PlacedStructural[],
): WallSnapResult {
  const length = wallLength(wallSide, room);
  if (elementWidth > length) return { fits: false };

  const sameWall = others.filter((o) => o.wall_side === wallSide);
  const maxOffset = Math.max(length - elementWidth, 0);
  const clamped = Math.min(Math.max(proposedOffset, 0), maxOffset);

  let bestOffset = clamped;
  let bestDist = SNAP_THRESHOLD_CM;
  for (const raw of [
    0,
    maxOffset,
    ...sameWall.flatMap((o) => [o.offset_cm - elementWidth, o.offset_cm + o.width_cm]),
  ]) {
    const candidate = Math.min(Math.max(raw, 0), maxOffset);
    const dist = Math.abs(clamped - candidate);
    if (dist < bestDist) {
      bestDist = dist;
      bestOffset = candidate;
    }
  }

  const overlaps = sameWall.some((o) =>
    segmentsOverlap(bestOffset, elementWidth, o.offset_cm, o.width_cm),
  );
  if (overlaps) return { fits: false };

  return { fits: true, wall_side: wallSide, offset_cm: bestOffset };
}

// Drop-point based (chip drag or an existing element's own reposition-drag
// commit). Tries the nearest wall first, then falls through the other 3 in
// increasing distance order before giving up — a drop rarely needs to be
// pixel-perfect on the "right" wall to land somewhere reasonable, matching
// "give it a larger area to aim for."
export function resolveWallDrop(
  elementWidth: number,
  localXcm: number,
  localYcm: number,
  room: { width_cm: number; depth_cm: number },
  others: PlacedStructural[],
): WallSnapResult {
  for (const wall of wallsByDistance(localXcm, localYcm, room)) {
    const result = resolveWallPlacement(
      elementWidth,
      wall.wall_side,
      wall.along - elementWidth / 2,
      room,
      others,
    );
    if (result.fits) return result;
  }
  return { fits: false };
}

// Unvalidated nearest-wall position for live drag feedback — no overlap
// check, always returns *something* so the dragged bar can track the
// pointer smoothly every frame instead of freezing whenever the current
// point doesn't happen to be a valid final resting spot. Only
// resolveWallDrop's result should ever be persisted.
export function previewWallPosition(
  elementWidth: number,
  localXcm: number,
  localYcm: number,
  room: { width_cm: number; depth_cm: number },
): { wall_side: WallSide; offset_cm: number } {
  const [nearest] = wallsByDistance(localXcm, localYcm, room);
  const length = wallLength(nearest.wall_side, room);
  const maxOffset = Math.max(length - elementWidth, 0);
  const offset_cm = Math.min(Math.max(nearest.along - elementWidth / 2, 0), maxOffset);
  return { wall_side: nearest.wall_side, offset_cm };
}
