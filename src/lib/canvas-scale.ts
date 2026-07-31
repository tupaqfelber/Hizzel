// Computes one uniform px-per-cm factor so every room and item on the canvas
// renders at accurate relative proportions to each other — the core "trustworthy
// previsualisation" requirement. Fits the bounding box of all rooms in the current
// area into the available viewport, preserving aspect ratio (no independent x/y
// stretch, which would distort real-world proportions).

export interface RoomBounds {
  canvas_x: number;
  canvas_y: number;
  width_cm: number;
  depth_cm: number;
}

export interface CanvasScale {
  pxPerCm: number;
  minXCm: number;
  minYCm: number;
  contentWidthPx: number;
  contentHeightPx: number;
  // Centers the (already fit-to-viewport) content within the viewport —
  // without this, a room bounding box whose aspect ratio doesn't match the
  // viewport's leaves all its leftover space on the right/bottom (the
  // uniform scale only shrinks to fit, it doesn't reposition), reading as
  // "small and shoved into the top-left corner".
  offsetXPx: number;
  offsetYPx: number;
}

const DEFAULT_PADDING_PX = 32;
const DEFAULT_PX_PER_CM = 0.5; // used when there are no rooms yet

export function computeCanvasScale(
  rooms: RoomBounds[],
  viewportWidth: number,
  viewportHeight: number,
  paddingPx: number = DEFAULT_PADDING_PX,
): CanvasScale {
  if (rooms.length === 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return {
      pxPerCm: DEFAULT_PX_PER_CM,
      minXCm: 0,
      minYCm: 0,
      contentWidthPx: 0,
      contentHeightPx: 0,
      offsetXPx: 0,
      offsetYPx: 0,
    };
  }

  const minXCm = Math.min(...rooms.map((r) => r.canvas_x));
  const minYCm = Math.min(...rooms.map((r) => r.canvas_y));
  const maxXCm = Math.max(...rooms.map((r) => r.canvas_x + r.width_cm));
  const maxYCm = Math.max(...rooms.map((r) => r.canvas_y + r.depth_cm));

  const contentWidthCm = Math.max(maxXCm - minXCm, 1);
  const contentHeightCm = Math.max(maxYCm - minYCm, 1);

  const availableWidth = Math.max(viewportWidth - paddingPx * 2, 1);
  const availableHeight = Math.max(viewportHeight - paddingPx * 2, 1);

  const pxPerCm = Math.min(
    availableWidth / contentWidthCm,
    availableHeight / contentHeightCm,
  );

  const contentWidthPx = contentWidthCm * pxPerCm;
  const contentHeightPx = contentHeightCm * pxPerCm;

  return {
    pxPerCm,
    minXCm,
    minYCm,
    contentWidthPx,
    contentHeightPx,
    offsetXPx: Math.max(viewportWidth - contentWidthPx, 0) / 2,
    offsetYPx: Math.max(viewportHeight - contentHeightPx, 0) / 2,
  };
}

export function cmToPx(cm: number, scale: CanvasScale) {
  return cm * scale.pxPerCm;
}

// For actual on-screen POSITION (left/top) only — not size (width/height),
// which stays a plain cmToPx. Centers the content within the viewport;
// see the offsetXPx/offsetYPx comment on CanvasScale for why this exists.
export function canvasXToPx(cm: number, scale: CanvasScale) {
  return cm * scale.pxPerCm + scale.offsetXPx;
}

export function canvasYToPx(cm: number, scale: CanvasScale) {
  return cm * scale.pxPerCm + scale.offsetYPx;
}
