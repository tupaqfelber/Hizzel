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
  // Whether a placements row exists at all for this thing, regardless of
  // its room_id. A thing that's never been touched has no row and
  // roomId collapses to null the same as one that was explicitly sent
  // back to the tray — this is the only way to tell those two apart.
  // Hizzel's tray must only show the latter (see hasPlacement's use in
  // HizzelWorld/HizzelMidPanel's tray filter).
  hasPlacement: boolean;
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
        supabase
          .from("placements")
          .select("thing_id, room_id, x_cm, y_cm, rotation_deg")
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
          hasPlacement: !!p,
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
}

export function usePlaceItem(moveId: string | undefined) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PlaceInput) => {
      if (!moveId) throw new Error("No current move");
      const { error } = await supabase.from("placements").upsert(
        {
          thing_id: input.thingId,
          move_id: moveId,
          room_id: input.roomId,
          x_cm: input.x_cm,
          y_cm: input.y_cm,
          rotation_deg: input.rotation_deg,
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
                // This call always upserts a placements row, whatever
                // roomId it's setting — so the item now has one, even if
                // it never did before (e.g. a never-touched thing dropped
                // straight onto the tray).
                hasPlacement: true,
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
