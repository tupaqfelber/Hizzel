"use client";

import { useState } from "react";
import { usePostHog } from "posthog-js/react";
import { IconTrash } from "@tabler/icons-react";
import { Sheet, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { FieldLabel, InputField } from "@/components/ui/field";
import { GhostButton, SolidButton } from "@/components/ui/button";
import {
  useImportFloorPlan,
  type ExtractResponse,
  type ExtractedRoom,
} from "@/hooks/use-floorplan-import";

interface DraftFloor {
  areaName: string;
  rooms: ExtractedRoom[];
}

// Reviews and lets the user correct an AI extraction before anything is
// written — nothing here touches the database until "Import". When
// reviewing a re-upload, Import replaces the property's *entire* existing
// floor plan (every area, not just whichever one was on screen) so a
// multi-floor extraction can't leave stale duplicate areas behind.
export function FloorPlanReviewSheet({
  propertyId,
  moveId,
  hasExistingPlan,
  extraction,
  onClose,
}: {
  propertyId: string;
  moveId: string | undefined;
  hasExistingPlan: boolean;
  extraction: ExtractResponse;
  onClose: () => void;
}) {
  const [floors, setFloors] = useState<DraftFloor[]>(
    extraction.floors.map((f) => ({
      areaName: f.suggestedAreaName,
      rooms: f.rooms.map((r) => ({ ...r })),
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importFloorPlan = useImportFloorPlan(moveId);
  const posthog = usePostHog();

  function updateRoom(floorIndex: number, roomIndex: number, patch: Partial<ExtractedRoom>) {
    setFloors((prev) =>
      prev.map((f, fi) =>
        fi !== floorIndex
          ? f
          : { ...f, rooms: f.rooms.map((r, ri) => (ri === roomIndex ? { ...r, ...patch } : r)) },
      ),
    );
  }

  function removeRoom(floorIndex: number, roomIndex: number) {
    setFloors((prev) =>
      prev.map((f, fi) =>
        fi !== floorIndex ? f : { ...f, rooms: f.rooms.filter((_, ri) => ri !== roomIndex) },
      ),
    );
  }

  function updateAreaName(floorIndex: number, name: string) {
    setFloors((prev) => prev.map((f, fi) => (fi === floorIndex ? { ...f, areaName: name } : f)));
  }

  async function handleImport() {
    setSaving(true);
    setError(null);
    try {
      await importFloorPlan.mutateAsync({
        propertyId,
        replaceExisting: hasExistingPlan,
        floors,
      });
      posthog?.capture("floorplan_uploaded", {
        floorCount: floors.length,
        roomCount: floors.reduce((n, f) => n + f.rooms.length, 0),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  const hasAnyRooms = floors.some((f) => f.rooms.length > 0);

  return (
    <Sheet title="Review floor plan" onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col">
        <SheetBody>
          {hasExistingPlan && (
            <p className="mb-3 rounded-[11px] bg-linen-field px-3.5 py-3 text-xs text-linen-ink-secondary">
              This replaces your current floor plan — its areas and rooms will be removed,
              and anything placed in them sent back to the tray.
            </p>
          )}
          {floors.map((floor, fi) => (
            <div key={fi} className={fi > 0 ? "mt-6" : ""}>
              <FieldLabel>Area name</FieldLabel>
              <InputField value={floor.areaName} onChange={(e) => updateAreaName(fi, e.target.value)} />

              <FieldLabel>Rooms</FieldLabel>
              <div className="flex flex-col gap-2">
                {floor.rooms.map((room, ri) => (
                  <div key={ri} className="flex items-center gap-2 rounded-[11px] bg-linen-field p-2">
                    <input
                      value={room.name}
                      onChange={(e) => updateRoom(fi, ri, { name: e.target.value })}
                      aria-label="Room name"
                      className="min-w-0 flex-1 rounded-[8px] bg-transparent px-2 py-2 text-sm text-linen-ink focus:outline-none"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={room.width_cm}
                      onChange={(e) => updateRoom(fi, ri, { width_cm: Number(e.target.value) })}
                      aria-label="Width, cm"
                      className="w-14 shrink-0 rounded-[8px] bg-transparent py-2 text-center text-sm text-linen-ink focus:outline-none"
                    />
                    <span className="shrink-0 text-[13px] text-[#B0A898]">×</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={room.depth_cm}
                      onChange={(e) => updateRoom(fi, ri, { depth_cm: Number(e.target.value) })}
                      aria-label="Depth, cm"
                      className="w-14 shrink-0 rounded-[8px] bg-transparent py-2 text-center text-sm text-linen-ink focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeRoom(fi, ri)}
                      aria-label="Remove room"
                      className="shrink-0 p-1 text-linen-ink-tertiary"
                    >
                      <IconTrash size={15} />
                    </button>
                  </div>
                ))}
                {floor.rooms.length === 0 && (
                  <p className="py-2 text-center text-xs text-linen-ink-tertiary">
                    No rooms left in this area
                  </p>
                )}
              </div>
            </div>
          ))}
          {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
        </SheetBody>
        <SheetFooter>
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <SolidButton onClick={handleImport} disabled={saving || !hasAnyRooms}>
            Import
          </SolidButton>
        </SheetFooter>
      </div>
    </Sheet>
  );
}
