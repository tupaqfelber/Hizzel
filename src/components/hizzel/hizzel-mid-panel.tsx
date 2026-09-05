"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { IconPlus, IconUpload, IconArrowsDiagonal } from "@tabler/icons-react";
import { useCurrentMove } from "@/hooks/use-current-move";
import { useAreas, useCreateArea } from "@/hooks/use-areas";
import { useRooms } from "@/hooks/use-rooms";
import { useMoveItems, type MoveItem } from "@/hooks/use-move-items";
import { useFlashStore } from "@/hooks/use-flash-store";
import { useBillingStatus } from "@/hooks/use-billing-status";
import { usePaywallStore } from "@/hooks/use-paywall-store";
import { computeCanvasScale, cmToPx } from "@/lib/canvas-scale";
import { rotatedFootprint } from "@/lib/item-snap";
import { CATEGORY_COLORS, categoryFlashColor } from "@/lib/category-colors";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { RoomFormSheet } from "@/components/hizzel/room-form-sheet";
import { FloorPlanReviewSheet } from "@/components/hizzel/floorplan-review-sheet";
import { useExtractFloorPlan, type ExtractResponse } from "@/hooks/use-floorplan-import";

// The Mid resting stop's right half: a miniature read-only preview of the
// floor plan (tap = jump to full Hizzel, drop a Things card here = magical
// auto-placement reusing the exact same cross-world drop pipeline things-world
// already runs — the thumbnail's rooms carry the same data-room-id /
// data-width-cm / data-depth-cm attributes real canvas rooms do, so that
// pipeline's elementFromPoint hit-test just works against it unchanged) plus
// the unassigned/tray list below it. No manual placement happens here.
export function HizzelMidPanel({
  widthPx,
  mobileActive,
  onExpand,
}: {
  widthPx: number;
  mobileActive: boolean;
  onExpand: () => void;
}) {
  const { data: move } = useCurrentMove();
  const newProperty = move?.properties.find((p) => p.role === "new");
  const { data: areas } = useAreas(newProperty?.id);
  const area = areas?.[0];
  const { data: rooms } = useRooms(area?.id);
  const { data: items } = useMoveItems(move?.id);
  const flashingIds = useFlashStore((s) => s.flashingIds);
  // This file only ever gates Add Room / Upload Plan, both deliberately
  // exempt-from-example (see their own comments) — no combined
  // example-exempt value is needed here, unlike hizzel-world.tsx /
  // things-world.tsx.
  const { hizzelUnlocked: accountUnlocked } = useBillingStatus();
  const createArea = useCreateArea(newProperty?.id);
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  // Same reasoning as HizzelWorld: `area` (areas?.[0]) is undefined with
  // zero areas, which silently no-op'd this whole button. Tracked
  // separately from `area` so a just-created area can open the sheet
  // immediately without waiting on the areas query's refetch.
  const [addRoomAreaId, setAddRoomAreaId] = useState<string | undefined>(undefined);
  const [extracting, setExtracting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<ExtractResponse | null>(null);
  const planFileInputRef = useRef<HTMLInputElement>(null);
  const extractFloorPlan = useExtractFloorPlan();

  async function handlePlanFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExtracting(true);
    setUploadError(null);
    try {
      const result = await extractFloorPlan.mutateAsync(file);
      setReviewData(result);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Couldn't read that file");
    } finally {
      setExtracting(false);
    }
  }

  async function handleAddRoomClick() {
    // Deliberately accountUnlocked, not hizzelUnlocked — adding a room /
    // uploading a plan is the actual paid feature, not just trying the
    // example out. Everything else in this file uses the example-exempt
    // value; these two don't.
    if (!accountUnlocked) {
      usePaywallStore.getState().open();
      return;
    }
    let areaId = area?.id;
    if (!areaId && newProperty?.id) {
      try {
        areaId = await createArea.mutateAsync("Ground floor");
      } catch (err) {
        console.error("Couldn't create a default area for the first room", err);
        return;
      }
    }
    if (!areaId) return;
    setAddRoomAreaId(areaId);
    setAddRoomOpen(true);
  }

  function handlePlanButtonClick() {
    // Deliberately accountUnlocked, not hizzelUnlocked — see
    // handleAddRoomClick's comment above.
    if (!accountUnlocked) {
      usePaywallStore.getState().open();
      return;
    }
    if ((areas?.length ?? 0) > 0) {
      const confirmed = window.confirm(
        "Uploading a new plan will delete your existing floor plan — all its areas and rooms will be removed, and anything placed in them returned to the tray. Continue?",
      );
      if (!confirmed) return;
    }
    planFileInputRef.current?.click();
  }

  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbSize, setThumbSize] = useState({ width: 0, height: 0 });

  function measureThumb() {
    if (!thumbRef.current) return;
    const rect = thumbRef.current.getBoundingClientRect();
    setThumbSize({ width: rect.width, height: rect.height });
  }

  useEffect(() => {
    if (!thumbRef.current) return;
    const el = thumbRef.current;
    const observer = new ResizeObserver(() => measureThumb());
    observer.observe(el);
    measureThumb();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    measureThumb();
  }, [widthPx]);

  // A much smaller padding than the full canvas's default (32px) — on a
  // ~110px-tall thumbnail that default eats most of the usable space,
  // shrinking rooms enough to make them hard to hit precisely with a
  // real finger.
  const scale = computeCanvasScale(rooms ?? [], thumbSize.width, thumbSize.height, 6);

  const roomIdSet = new Set((rooms ?? []).map((r) => r.id));
  // Same fix as HizzelWorld's trayItems — this mirrors the tray (items
  // explicitly sent here, via inTray), not the full unassigned list from
  // Things world, and must stay stable regardless of which area's rooms
  // are loaded here.
  const unassigned = (items ?? []).filter((i) => !i.roomId && i.inTray);
  const itemsByRoom = new Map<string, MoveItem[]>();
  for (const item of items ?? []) {
    if (item.roomId && roomIdSet.has(item.roomId) && item.x_cm != null && item.y_cm != null) {
      if (!itemsByRoom.has(item.roomId)) itemsByRoom.set(item.roomId, []);
      itemsByRoom.get(item.roomId)!.push(item);
    }
  }

  return (
    <div
      data-hizzel-mid-zone
      className={`relative ${mobileActive ? "flex" : "hidden"} h-dvh min-w-0 shrink-0 flex-col overflow-hidden bg-dark lg:hidden ${widthPx === 0 ? "pointer-events-none" : ""}`}
      style={{ width: `${widthPx}px` }}
    >
      <div className="flex items-center gap-3 px-3.5 pt-3.5 pb-2.5">
        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center">
          <Image src="/logo-on-dark.png" alt="" width={38} height={38} />
        </div>
        <div className="min-w-0">
          <div className="mb-0.5 text-[9px] tracking-[0.14em] text-dark-ink-secondary uppercase">
            Hizzel
          </div>
          <h1 className="truncate font-serif text-[17px] leading-none tracking-[-0.3px] text-dark-ink">
            {newProperty?.nickname ?? "…"}
          </h1>
          <div className="mt-[3px] text-[9px] text-dark-ink-tertiary">
            {area?.name ?? "No area yet"}
          </div>
        </div>
      </div>

      <div className="mx-3.5 mb-3 shrink-0">
        <div className="mb-1.5 flex items-center justify-between">
          <button
            type="button"
            onClick={handleAddRoomClick}
            disabled={createArea.isPending}
            className="flex items-center gap-1 rounded-lg border-[0.5px] border-dark-ink/10 bg-dark-ink/[.07] px-[7px] py-[3px] text-[9px] font-medium text-dark-tool-label disabled:opacity-60"
          >
            <IconPlus size={9} /> Room
          </button>
          <button
            type="button"
            onClick={handlePlanButtonClick}
            disabled={extracting}
            className="flex items-center gap-1 rounded-lg border-[0.5px] border-dark-ink/10 bg-dark-ink/[.07] px-[7px] py-[3px] text-[9px] font-medium text-dark-tool-label disabled:opacity-60"
          >
            <IconUpload size={9} /> {extracting ? "Reading…" : "Plan"}
          </button>
          <input
            ref={planFileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handlePlanFileSelected}
          />
        </div>
        {uploadError && (
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="mt-1.5 w-full rounded-lg bg-dark-ink/[.07] px-2.5 py-1.5 text-left text-[9px] text-dark-ink-tertiary"
          >
            {uploadError}
          </button>
        )}
        <div
          ref={thumbRef}
          onClick={onExpand}
          role="button"
          aria-label="Open full floor plan"
          className="relative h-[110px] cursor-pointer overflow-hidden rounded-xl border border-dark-ink/[.14] bg-dark-ink/[.04]"
        >
          {rooms?.map((room) => (
            <div
              key={room.id}
              data-room-id={room.id}
              data-width-cm={room.width_cm}
              data-depth-cm={room.depth_cm}
              className="absolute overflow-hidden rounded-[1px] border border-dark-ink/30"
              style={{
                left: cmToPx(room.canvas_x - scale.minXCm, scale),
                top: cmToPx(room.canvas_y - scale.minYCm, scale),
                width: cmToPx(room.width_cm, scale),
                height: cmToPx(room.depth_cm, scale),
              }}
            >
              {(itemsByRoom.get(room.id) ?? []).map((item) => {
                const fp = rotatedFootprint(item);
                return (
                  <div
                    key={item.id}
                    className={`absolute rounded-[1.5px] ${flashingIds.has(item.id) ? "animate-item-flash" : ""}`}
                    style={
                      {
                        left: cmToPx(item.x_cm!, scale),
                        top: cmToPx(item.y_cm!, scale),
                        width: cmToPx(fp.w, scale),
                        height: cmToPx(fp.d, scale),
                        backgroundColor: CATEGORY_COLORS[item.category].bold,
                        "--flash-color": categoryFlashColor(item.category),
                      } as React.CSSProperties
                    }
                  />
                );
              })}
            </div>
          ))}
          {rooms?.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-[9px] text-dark-ink-tertiary">
              Add a room or upload a plan
            </p>
          )}
          <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-dark-ink/10 text-dark-ink/65">
              <IconArrowsDiagonal size={11} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-3.5 mb-2 h-px shrink-0 bg-dark-ink/[.08]" />
      <div className="shrink-0 px-3.5 pb-1.5 text-[8px] font-medium tracking-[0.1em] text-dark-ink-tertiary uppercase">
        Unassigned
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3.5 pb-[90px] [scrollbar-width:none]">
        {unassigned.map((item) => {
          const Icon = CATEGORY_ICONS[item.category];
          const color = CATEGORY_COLORS[item.category];
          return (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-[10px] border-[0.5px] border-dark-ink/10 bg-dark-ink/[.05] p-[6px]"
            >
              <div
                className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[7px] ${flashingIds.has(item.id) ? "animate-item-flash" : ""}`}
                style={
                  {
                    backgroundColor: color.bold,
                    "--flash-color": categoryFlashColor(item.category),
                  } as React.CSSProperties
                }
              >
                <Icon size={15} className="text-white/85" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[10px] font-medium text-[#E8E4DC]">
                  {item.name}
                </div>
                <div className="mt-[1px] text-[8px] text-dark-ink-tertiary">
                  {item.width_cm}×{item.depth_cm}
                </div>
              </div>
            </div>
          );
        })}
        {unassigned.length === 0 && (
          <p className="pt-4 text-center text-[10px] text-dark-ink-tertiary">
            All items placed
          </p>
        )}
      </div>

      {addRoomOpen && addRoomAreaId && (
        <RoomFormSheet
          areaId={addRoomAreaId}
          onClose={() => {
            setAddRoomOpen(false);
            setAddRoomAreaId(undefined);
          }}
        />
      )}
      {reviewData && newProperty && (
        <FloorPlanReviewSheet
          propertyId={newProperty.id}
          moveId={move?.id}
          hasExistingPlan={(areas?.length ?? 0) > 0}
          extraction={reviewData}
          onClose={() => setReviewData(null)}
        />
      )}
    </div>
  );
}
