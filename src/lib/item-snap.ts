// Snapping and boundary rules for items placed inside a room: clamp within
// the room (items never cross a wall), snap to the room's edges and to
// other items' edges when close, and avoid landing on top of another item.
// The dragged item always lands exactly where it's snapped to — if that
// spot is occupied, whatever's there gets pushed aside (and anything that
// bumps into, cascading) rather than the dragged item being redirected
// elsewhere.

export interface Footprint {
  w: number;
  d: number;
}

export interface PlacedRect extends Footprint {
  x: number;
  y: number;
}

export interface PlacedItem extends PlacedRect {
  id: string;
}

const SNAP_THRESHOLD_CM = 15;
const OVERLAP_EPSILON_CM = 0.5;
const MAX_DISPLACEMENT_PASSES = 40;

// A 90°/270° rotation swaps which physical dimension faces width vs depth.
export function rotatedFootprint(item: {
  width_cm: number;
  depth_cm: number;
  rotation_deg: number;
}): Footprint {
  const swapped = ((item.rotation_deg % 180) + 180) % 180 !== 0;
  return swapped
    ? { w: item.depth_cm, d: item.width_cm }
    : { w: item.width_cm, d: item.depth_cm };
}

function rectsOverlap(a: PlacedRect, b: PlacedRect) {
  return (
    a.x < b.x + b.w - OVERLAP_EPSILON_CM &&
    a.x + a.w > b.x + OVERLAP_EPSILON_CM &&
    a.y < b.y + b.d - OVERLAP_EPSILON_CM &&
    a.y + a.d > b.y + OVERLAP_EPSILON_CM
  );
}

// Shortest-escape push: which direction actually clears `rect` of `collider`
// once clamped to the room's walls. A direction can look shortest on paper
// but land right back in the overlap once clamped (the wall is closer than
// the collider) — so each candidate is verified post-clamp, not just picked
// by raw distance.
function escapePush(
  rect: PlacedRect,
  collider: PlacedRect,
  room: { width_cm: number; depth_cm: number },
): { x: number; y: number } {
  const maxX = Math.max(room.width_cm - rect.w, 0);
  const maxY = Math.max(room.depth_cm - rect.d, 0);

  const pushLeft = rect.x + rect.w - collider.x;
  const pushRight = collider.x + collider.w - rect.x;
  const pushUp = rect.y + rect.d - collider.y;
  const pushDown = collider.y + collider.d - rect.y;

  const candidates = [
    { dx: -pushLeft, dy: 0, dist: pushLeft },
    { dx: pushRight, dy: 0, dist: pushRight },
    { dx: 0, dy: -pushUp, dist: pushUp },
    { dx: 0, dy: pushDown, dist: pushDown },
  ];
  candidates.sort((a, b) => a.dist - b.dist);

  for (const c of candidates) {
    const nx = Math.min(Math.max(rect.x + c.dx, 0), maxX);
    const ny = Math.min(Math.max(rect.y + c.dy, 0), maxY);
    if (!rectsOverlap({ x: nx, y: ny, w: rect.w, d: rect.d }, collider)) {
      return { x: nx, y: ny };
    }
  }

  // Boxed in on every side — no direction actually escapes within the
  // room. Best-effort: take the shortest push, clamped, same as before.
  const fallback = candidates[0];
  return {
    x: Math.min(Math.max(rect.x + fallback.dx, 0), maxX),
    y: Math.min(Math.max(rect.y + fallback.dy, 0), maxY),
  };
}

function snapItemPosition(
  footprint: Footprint,
  proposedX: number,
  proposedY: number,
  room: { width_cm: number; depth_cm: number },
  others: PlacedRect[],
): { x: number; y: number } {
  const { w, d } = footprint;
  const maxX = Math.max(room.width_cm - w, 0);
  const maxY = Math.max(room.depth_cm - d, 0);

  const clampedX = Math.min(Math.max(proposedX, 0), maxX);
  const clampedY = Math.min(Math.max(proposedY, 0), maxY);

  let bestX = clampedX;
  let bestXDist = SNAP_THRESHOLD_CM;
  for (const raw of [0, maxX, ...others.flatMap((o) => [o.x - w, o.x + o.w])]) {
    const candidate = Math.min(Math.max(raw, 0), maxX);
    const dist = Math.abs(clampedX - candidate);
    if (dist < bestXDist) {
      bestXDist = dist;
      bestX = candidate;
    }
  }

  let bestY = clampedY;
  let bestYDist = SNAP_THRESHOLD_CM;
  for (const raw of [0, maxY, ...others.flatMap((o) => [o.y - d, o.y + o.d])]) {
    const candidate = Math.min(Math.max(raw, 0), maxY);
    const dist = Math.abs(clampedY - candidate);
    if (dist < bestYDist) {
      bestYDist = dist;
      bestY = candidate;
    }
  }

  return { x: bestX, y: bestY };
}

export type PlacementResult =
  | {
      fits: true;
      x: number;
      y: number;
      displaced: { id: string; x: number; y: number }[];
      unplaced: string[];
    }
  | { fits: false };

// Places `footprint` at its snapped position and, if that lands on top of
// existing items, bumps them (and anything they in turn bump into) to the
// nearest clear spot instead of redirecting the dragged item elsewhere.
// Bounded pass count: in a genuinely packed room this is best-effort — any
// item that still can't be resolved after the cascade settles is reported
// in `unplaced` rather than left overlapping, so the caller can send it back
// to the tray instead of quietly accepting a collision. If the incoming
// footprint doesn't fit inside the room at all (regardless of what else is
// in it), the placement is rejected outright (`fits: false`).
export function resolvePlacement(
  footprint: Footprint,
  proposedX: number,
  proposedY: number,
  room: { width_cm: number; depth_cm: number },
  others: PlacedItem[],
): PlacementResult {
  if (footprint.w > room.width_cm || footprint.d > room.depth_cm) {
    return { fits: false };
  }

  const { x, y } = snapItemPosition(footprint, proposedX, proposedY, room, others);
  const draggedRect: PlacedRect = { x, y, w: footprint.w, d: footprint.d };

  const working = new Map(others.map((o) => [o.id, { ...o }]));
  const moved = new Set<string>();

  function rectFor(id: string): PlacedRect {
    return working.get(id)!;
  }

  function findCollider(id: string): PlacedRect | undefined {
    const rect = rectFor(id);
    if (rectsOverlap(rect, draggedRect)) return draggedRect;
    for (const [otherId, otherRect] of working) {
      if (otherId !== id && rectsOverlap(rect, otherRect)) return otherRect;
    }
    return undefined;
  }

  const queue: string[] = [...working.keys()].filter((id) =>
    rectsOverlap(rectFor(id), draggedRect),
  );
  let guard = 0;

  while (queue.length > 0 && guard < MAX_DISPLACEMENT_PASSES) {
    guard++;
    const id = queue.shift()!;
    const collider = findCollider(id);
    if (!collider) continue;

    const rect = rectFor(id);
    const next = escapePush(rect, collider, room);
    const stuck = next.x === rect.x && next.y === rect.y;
    rect.x = next.x;
    rect.y = next.y;
    moved.add(id);

    // If it didn't actually move (boxed in on every side), don't keep
    // re-queuing it — that would just burn the whole guard budget on one
    // unsolvable item and starve everything else.
    if (stuck) continue;

    queue.push(id);
    for (const otherId of working.keys()) {
      if (otherId !== id && !queue.includes(otherId) && rectsOverlap(rect, rectFor(otherId))) {
        queue.push(otherId);
      }
    }
  }

  // Final check: anything still overlapping something else once the cascade
  // has settled (or run out of passes) couldn't actually be resolved —
  // report it separately so the caller can unplace it rather than leave it
  // sitting on top of another item.
  const unplaced: string[] = [];
  for (const [id, rect] of working) {
    const stillOverlapping =
      rectsOverlap(rect, draggedRect) ||
      [...working].some(([otherId, otherRect]) => otherId !== id && rectsOverlap(rect, otherRect));
    if (stillOverlapping) unplaced.push(id);
  }

  const unplacedSet = new Set(unplaced);
  const displaced = [...moved]
    .filter((id) => !unplacedSet.has(id))
    .map((id) => {
      const rect = rectFor(id);
      return { id, x: rect.x, y: rect.y };
    });

  return { fits: true, x, y, displaced, unplaced };
}
