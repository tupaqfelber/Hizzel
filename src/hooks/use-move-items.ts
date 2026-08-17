import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { ThingCategory } from "@/lib/supabase/types";

export interface MoveItem {
  id: string;
  name: string;
  category: ThingCategory;
  width_cm: number;
  depth_cm: number;
  height_cm: number;
  photo_url: string | null;
  notes: string | null;
  roomId: string | null;
  x_cm: number | null;
  y_cm: number | null;
  rotation_deg: number;
  // Explicit "belongs in Hizzel's tray" flag — room_id: null alone can't
  // carry this: it's identical whether a thing has never been touched, was
  // sent straight to the tray, or was just moved to Unassigned within
  // Things (which should NOT show up in the tray). See the migration
  // comment (20260817120000_placements_in_tray.sql) for the full reasoning.
  inTray: boolean;
}

// `placements.in_tray` isn't in the generated Database type yet — added by
// a migration (supabase/migrations/20260817120000_placements_in_tray.sql)
// that hasn't been applied to the live project. Once it's applied,
// regenerate src/lib/supabase/types.ts and delete this interface + the
// casts below, same as the import_floor_plan RPC cast in
// use-floorplan-import.ts.
interface PlacementRow {
  thing_id: string;
  room_id: string | null;
  x_cm: number | null;
  y_cm: number | null;
  rotation_deg: number;
  in_tray: boolean;
}

interface PlacementsTable {
  from(table: "placements"): {
    select(cols: string): {
      eq(
        col: string,
        val: string,
      ): Promise<
        { data: PlacementRow[]; error: null } | { data: null; error: { message: string } }
      >;
    };
    upsert(
      values: {
        thing_id: string;
        move_id: string;
        room_id: string | null;
        x_cm: number | null;
        y_cm: number | null;
        rotation_deg: number;
        in_tray: boolean;
      },
      opts: { onConflict: string },
    ): Promise<{ error: { message: string } | null }>;
  };
}

export function useMoveItems(moveId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["move-items", moveId],
    enabled: !!moveId,
    queryFn: async () => {
      const [thingsRes, placementsRes] = await Promise.all([
        supabase
          .from("things")
          .select("id, name, category, width_cm, depth_cm, height_cm, photo_url, notes")
          .order("name"),
        (supabase as unknown as PlacementsTable)
          .from("placements")
          .select("thing_id, room_id, x_cm, y_cm, rotation_deg, in_tray")
          .eq("move_id", moveId!),
      ]);
      if (thingsRes.error) throw thingsRes.error;
      if (placementsRes.error) throw placementsRes.error;

      const placementByThing = new Map(placementsRes.data.map((p) => [p.thing_id, p]));

      return thingsRes.data.map((thing): MoveItem => {
        const p = placementByThing.get(thing.id);
        return {
          ...thing,
          roomId: p?.room_id ?? null,
          x_cm: p?.x_cm ?? null,
          y_cm: p?.y_cm ?? null,
          rotation_deg: p?.rotation_deg ?? 0,
          inTray: p?.in_tray ?? false,
        };
      });
    },
  });
}

interface PlaceInput {
  thingId: string;
  roomId: string | null;
  x_cm: number | null;
  y_cm: number | null;
  rotation_deg: number;
  // Only meaningful when roomId is null. Defaults to true — every existing
  // call site (drag/drop a placed item back to the tray, a rejected
  // placement bouncing back, confirming unassigned in Hizzel's Mid/tray
  // zones) genuinely means "send to tray". The one exception is dragging
  // to Unassigned within Things world, which explicitly passes false.
  // Ignored (forced false) whenever roomId is set — a placed item is never
  // "in the tray".
  inTray?: boolean;
}

export function usePlaceItem(moveId: string | undefined) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PlaceInput) => {
      if (!moveId) throw new Error("No current move");
      const { error } = await (supabase as unknown as PlacementsTable).from("placements").upsert(
        {
          thing_id: input.thingId,
          move_id: moveId,
          room_id: input.roomId,
          x_cm: input.x_cm,
          y_cm: input.y_cm,
          rotation_deg: input.rotation_deg,
          in_tray: input.roomId === null ? (input.inTray ?? true) : false,
        },
        { onConflict: "thing_id,move_id" },
      );
      if (error) throw error;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["move-items", moveId] });
      const previous = queryClient.getQueryData<MoveItem[]>(["move-items", moveId]);
      queryClient.setQueryData<MoveItem[]>(["move-items", moveId], (old) =>
        old?.map((item) =>
          item.id === input.thingId
            ? {
                ...item,
                roomId: input.roomId,
                x_cm: input.x_cm,
                y_cm: input.y_cm,
                rotation_deg: input.rotation_deg,
                inTray: input.roomId === null ? (input.inTray ?? true) : false,
              }
            : item,
        ),
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["move-items", moveId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["move-items", moveId] });
      queryClient.invalidateQueries({ queryKey: ["things-grouped"] });
    },
  });
}
