import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { uploadPropertyPhoto } from "@/lib/storage";
import type { PropertyRole } from "@/lib/supabase/types";

export interface MoveProperty {
  id: string;
  role: PropertyRole;
  nickname: string;
  address: string;
  photo_url: string | null;
}

export interface CurrentMove {
  id: string;
  is_example: boolean;
  move_date: string | null;
  notes: string | null;
  mover_name: string | null;
  mover_phone: string | null;
  properties: MoveProperty[];
}

export function useCurrentMove() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["current-move"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moves")
        .select(
          "id, is_example, move_date, notes, mover_name, mover_phone, properties(id, role, nickname, address, photo_url)",
        )
        .eq("status", "current")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as CurrentMove | null;
    },
  });
}

export function useOtherMoves(currentMoveId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["other-moves", currentMoveId],
    enabled: !!currentMoveId,
    queryFn: async () => {
      const { data: moves, error } = await supabase
        .from("moves")
        .select(
          "id, move_date, is_example, properties(id, role, nickname, areas(id, rooms(id)))",
        )
        .neq("id", currentMoveId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const moveIds = moves.map((m) => m.id);
      const { data: placements, error: placementsError } = moveIds.length
        ? await supabase
            .from("placements")
            .select("move_id")
            .in("move_id", moveIds)
        : { data: [], error: null };
      if (placementsError) throw placementsError;

      const thingCountByMove = new Map<string, number>();
      for (const p of placements) {
        thingCountByMove.set(p.move_id, (thingCountByMove.get(p.move_id) ?? 0) + 1);
      }

      return moves.map((move) => {
        const current = move.properties.find((p) => p.role === "current");
        const next = move.properties.find((p) => p.role === "new");
        const roomCount = move.properties.reduce(
          (sum, p) => sum + p.areas.reduce((s, a) => s + a.rooms.length, 0),
          0,
        );
        return {
          id: move.id,
          moveDate: move.move_date,
          isExample: move.is_example,
          displayName: `${current?.nickname ?? "?"} → ${next?.nickname ?? "?"}`,
          thingCount: thingCountByMove.get(move.id) ?? 0,
          roomCount,
        };
      });
    },
  });
}

interface MoveInput {
  move_date: string | null;
  notes: string;
  mover_name: string;
  mover_phone: string;
}

export function useUpdateMove() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: MoveInput & { id: string }) => {
      const { error } = await supabase
        .from("moves")
        .update({
          move_date: input.move_date,
          notes: input.notes || null,
          mover_name: input.mover_name || null,
          mover_phone: input.mover_phone || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-move"] });
    },
  });
}

interface PropertyInput {
  nickname: string;
  address: string;
  photoFile: File | null;
}

export function useUpdateProperty() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: PropertyInput & { id: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { error } = await supabase
        .from("properties")
        .update({ nickname: input.nickname, address: input.address })
        .eq("id", id);
      if (error) throw error;

      if (input.photoFile) {
        const photoUrl = await uploadPropertyPhoto(user.id, id, input.photoFile);
        const { error: photoError } = await supabase
          .from("properties")
          .update({ photo_url: photoUrl })
          .eq("id", id);
        if (photoError) throw photoError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-move"] });
    },
  });
}
