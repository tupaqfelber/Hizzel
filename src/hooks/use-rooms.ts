import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface RoomRow {
  id: string;
  area_id: string;
  name: string;
  width_cm: number;
  depth_cm: number;
  canvas_x: number;
  canvas_y: number;
  rotation_deg: number;
}

export function useRooms(areaId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["rooms", areaId],
    enabled: !!areaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, area_id, name, width_cm, depth_cm, canvas_x, canvas_y, rotation_deg")
        .eq("area_id", areaId!)
        .order("created_at");
      if (error) throw error;
      return data as RoomRow[];
    },
  });
}

const ROOM_GAP_CM = 30;

export function useCreateRoom(areaId: string | undefined) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; width_cm: number; depth_cm: number }) => {
      if (!areaId) throw new Error("No area");

      const { data: existing } = await supabase
        .from("rooms")
        .select("canvas_x, width_cm")
        .eq("area_id", areaId);

      const nextX = existing?.length
        ? Math.max(...existing.map((r) => r.canvas_x + r.width_cm)) + ROOM_GAP_CM
        : 0;

      const { error } = await supabase.from("rooms").insert({
        area_id: areaId,
        name: input.name,
        width_cm: input.width_cm,
        depth_cm: input.depth_cm,
        canvas_x: nextX,
        canvas_y: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", areaId] });
    },
  });
}

// Also covers moving a room to a different area (area_id) — invalidates
// broadly (every area's cached room list, not just one) since a move
// touches two areas' lists at once.
export function useUpdateRoom() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      width_cm?: number;
      depth_cm?: number;
      area_id?: string;
    }) => {
      const { id, ...changes } = input;
      const { error } = await supabase.from("rooms").update(changes).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
}

// Deleting a room returns anything placed in it to the tray for free —
// placements.room_id is `references rooms(id) on delete set null`. Its
// structural_elements (doors/windows) aren't so lucky — that FK cascades,
// so the cached structural-elements query needs an explicit invalidate too.
export function useDeleteRoom(areaId: string | undefined, moveId: string | undefined) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", areaId] });
      queryClient.invalidateQueries({ queryKey: ["move-items", moveId] });
      queryClient.invalidateQueries({ queryKey: ["structural-elements"] });
    },
  });
}

export function useUpdateRoomPosition(areaId: string | undefined) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; canvas_x: number; canvas_y: number }) => {
      const { error } = await supabase
        .from("rooms")
        .update({ canvas_x: input.canvas_x, canvas_y: input.canvas_y })
        .eq("id", input.id);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["rooms", areaId] });
      const previous = queryClient.getQueryData<RoomRow[]>(["rooms", areaId]);
      queryClient.setQueryData<RoomRow[]>(["rooms", areaId], (old) =>
        old?.map((r) =>
          r.id === input.id
            ? { ...r, canvas_x: input.canvas_x, canvas_y: input.canvas_y }
            : r,
        ),
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["rooms", areaId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", areaId] });
    },
  });
}
