// Snaps a dragged room's edges to nearby room edges so shared walls collapse
// to a single line, flush with no gap or overlap. Independent per axis, and
// only snaps an axis when the rooms plausibly share that wall (their extent
// on the other axis overlaps) — otherwise a distant, unrelated room could
// pull the dragged room toward it. If snapping still leaves the room
// overlapping a neighbor, push it out along the shortest direction until
// clear (rooms have no outer bounds, unlike items inside a room).

export interface RoomForSnap {
  canvas_x: number;
  canvas_y: number;
  width_cm: number;
  depth_cm: number;
}

const SNAP_THRESHOLD_CM = 20;
const OVERLAP_EPSILON_CM = 0.5;

function roomRectsOverlap(
  a: { x: number; y: number; width_cm: number; depth_cm: number },
  b: RoomForSnap,
) {
  return (
    a.x < b.canvas_x + b.width_cm - OVERLAP_EPSILON_CM &&
    a.x + a.width_cm > b.canvas_x + OVERLAP_EPSILON_CM &&
    a.y < b.canvas_y + b.depth_cm - OVERLAP_EPSILON_CM &&
    a.y + a.depth_cm > b.canvas_y + OVERLAP_EPSILON_CM
  );
}

function resolveRoomOverlap(
  rect: { x: number; y: number; width_cm: number; depth_cm: number },
  others: RoomForSnap[],
) {
  let current = { ...rect };

  for (let pass = 0; pass < 8; pass++) {
    const collider = others.find((o) => roomRectsOverlap(current, o));
    if (!collider) break;

    const pushLeft = current.x + current.width_cm - collider.canvas_x;
    const pushRight = collider.canvas_x + collider.width_cm - current.x;
    const pushUp = current.y + current.depth_cm - collider.canvas_y;
    const pushDown = collider.canvas_y + collider.depth_cm - current.y;

    const candidates = [
      { dx: -pushLeft, dy: 0, dist: pushLeft },
      { dx: pushRight, dy: 0, dist: pushRight },
      { dx: 0, dy: -pushUp, dist: pushUp },
      { dx: 0, dy: pushDown, dist: pushDown },
    ];
    candidates.sort((a, b) => a.dist - b.dist);
    const push = candidates[0];

    current = { ...current, x: current.x + push.dx, y: current.y + push.dy };
  }

  return current;
}

export function snapRoomPosition(
  dragged: { width_cm: number; depth_cm: number },
  proposedX: number,
  proposedY: number,
  others: RoomForSnap[],
): { x: number; y: number } {
  let snappedX = proposedX;
  let snappedY = proposedY;
  let bestXDist = SNAP_THRESHOLD_CM;
  let bestYDist = SNAP_THRESHOLD_CM;

  const draggedLeft = proposedX;
  const draggedRight = proposedX + dragged.width_cm;
  const draggedTop = proposedY;
  const draggedBottom = proposedY + dragged.depth_cm;

  for (const other of others) {
    const oLeft = other.canvas_x;
    const oRight = other.canvas_x + other.width_cm;
    const oTop = other.canvas_y;
    const oBottom = other.canvas_y + other.depth_cm;

    const verticalOverlap = draggedTop < oBottom && draggedBottom > oTop;
    if (verticalOverlap) {
      const xCandidates: [number, number, number][] = [
        [draggedRight, oLeft, oLeft - dragged.width_cm],
        [draggedLeft, oRight, oRight],
        [draggedLeft, oLeft, oLeft],
        [draggedRight, oRight, oRight - dragged.width_cm],
      ];
      for (const [draggedEdge, otherEdge, resultX] of xCandidates) {
        const dist = Math.abs(draggedEdge - otherEdge);
        if (dist < bestXDist) {
          bestXDist = dist;
          snappedX = resultX;
        }
      }
    }

    const horizontalOverlap = draggedLeft < oRight && draggedRight > oLeft;
    if (horizontalOverlap) {
      const yCandidates: [number, number, number][] = [
        [draggedBottom, oTop, oTop - dragged.depth_cm],
        [draggedTop, oBottom, oBottom],
        [draggedTop, oTop, oTop],
        [draggedBottom, oBottom, oBottom - dragged.depth_cm],
      ];
      for (const [draggedEdge, otherEdge, resultY] of yCandidates) {
        const dist = Math.abs(draggedEdge - otherEdge);
        if (dist < bestYDist) {
          bestYDist = dist;
          snappedY = resultY;
        }
      }
    }
  }

  const snappedRect = { x: snappedX, y: snappedY, width_cm: dragged.width_cm, depth_cm: dragged.depth_cm };
  if (!others.some((o) => roomRectsOverlap(snappedRect, o))) {
    return { x: snappedX, y: snappedY };
  }

  // Snapping landed on top of a neighboring room — push out until clear.
  const resolved = resolveRoomOverlap(snappedRect, others);
  return { x: resolved.x, y: resolved.y };
}
