import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { StructuralType, WallSide } from "@/lib/supabase/types";

export interface StructuralElementRow {
  id: string;
  room_id: string;
  type: StructuralType;
  wall_side: WallSide;
  offset_cm: number;
  width_cm: number;
}

// Scoped by every room id in the current area (not a single room) — all of
// an area's RoomBlocks render simultaneously, so a chip-drop can land on any
// of them and every room's elements need to already be loaded.
export function useStructuralElements(roomIds: string[] | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["structural-elements", roomIds],
    enabled: !!roomIds && roomIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("structural_elements")
        .select("id, room_id, type, wall_side, offset_cm, width_cm")
        .in("room_id", roomIds!);
      if (error) throw error;
      return data as StructuralElementRow[];
    },
  });
}

export function useCreateStructuralElement() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      room_id: string;
      type: StructuralType;
      wall_side: WallSide;
      offset_cm: number;
      width_cm: number;
    }) => {
      const { error } = await supabase.from("structural_elements").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["structural-elements"] });
    },
  });
}

export function useUpdateStructuralElement() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      wall_side?: WallSide;
      offset_cm?: number;
      width_cm?: number;
    }) => {
      const { id, ...changes } = input;
      const { error } = await supabase.from("structural_elements").update(changes).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["structural-elements"] });
    },
  });
}

export function useDeleteStructuralElement() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("structural_elements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["structural-elements"] });
    },
  });
}
