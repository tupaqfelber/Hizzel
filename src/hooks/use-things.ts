import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { uploadThingPhoto } from "@/lib/storage";
import type { ThingCategory } from "@/lib/supabase/types";

export interface ThingItem {
  id: string;
  name: string;
  category: ThingCategory;
  width_cm: number;
  depth_cm: number;
  height_cm: number;
  photo_url: string | null;
  notes: string | null;
  roomId: string | null;
}

export interface ThingGroup {
  roomName: string;
  items: ThingItem[];
}

export const UNASSIGNED = "Unassigned";

// `placements.in_tray` isn't in the generated Database type yet — see the
// matching comment in use-move-items.ts for the full explanation. Delete
// this cast once the migration's applied and types are regenerated.
interface PlacementsTable {
  from(table: "placements"): {
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

export function useGroupedThings(moveId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["things-grouped", moveId],
    enabled: !!moveId,
    queryFn: async () => {
      const [thingsRes, placementsRes] = await Promise.all([
        supabase
          .from("things")
          .select(
            "id, name, category, width_cm, depth_cm, height_cm, photo_url, notes",
          )
          .order("name"),
        supabase
          .from("placements")
          .select("thing_id, room_id, rooms(name)")
          .eq("move_id", moveId!),
      ]);

      if (thingsRes.error) throw thingsRes.error;
      if (placementsRes.error) throw placementsRes.error;

      const placementByThing = new Map(
        placementsRes.data.map((p) => [p.thing_id, p]),
      );

      const groupsByRoom = new Map<string, ThingGroup>();
      for (const thing of thingsRes.data) {
        const placement = placementByThing.get(thing.id);
        const roomName = placement?.room_id
          ? (placement.rooms?.name ?? UNASSIGNED)
          : UNASSIGNED;

        if (!groupsByRoom.has(roomName)) {
          groupsByRoom.set(roomName, { roomName, items: [] });
        }
        groupsByRoom.get(roomName)!.items.push({
          ...thing,
          roomId: placement?.room_id ?? null,
        });
      }

      // Unassigned leads — it's the to-do pile — then rooms alphabetically.
      const groups = [...groupsByRoom.values()].sort((a, b) => {
        if (a.roomName === UNASSIGNED) return -1;
        if (b.roomName === UNASSIGNED) return 1;
        return a.roomName.localeCompare(b.roomName);
      });

      return { groups, totalCount: thingsRes.data.length };
    },
  });
}

interface ThingInput {
  name: string;
  category: ThingCategory;
  width_cm: number;
  depth_cm: number;
  height_cm: number;
  notes: string;
  photoFile: File | null;
}

export function useCreateThing() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ThingInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data: thing, error } = await supabase
        .from("things")
        .insert({
          user_id: user.id,
          name: input.name,
          category: input.category,
          width_cm: input.width_cm,
          depth_cm: input.depth_cm,
          height_cm: input.height_cm,
          notes: input.notes || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (input.photoFile) {
        const photoUrl = await uploadThingPhoto(
          user.id,
          thing.id,
          input.photoFile,
        );
        const { error: updateError } = await supabase
          .from("things")
          .update({ photo_url: photoUrl })
          .eq("id", thing.id);
        if (updateError) throw updateError;
      }

      return thing.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["things-grouped"] });
    },
  });
}

export function useUpdateThing() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: ThingInput & { id: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { error } = await supabase
        .from("things")
        .update({
          name: input.name,
          category: input.category,
          width_cm: input.width_cm,
          depth_cm: input.depth_cm,
          height_cm: input.height_cm,
          notes: input.notes || null,
        })
        .eq("id", id);
      if (error) throw error;

      if (input.photoFile) {
        const photoUrl = await uploadThingPhoto(user.id, id, input.photoFile);
        const { error: updateError } = await supabase
          .from("things")
          .update({ photo_url: photoUrl })
          .eq("id", id);
        if (updateError) throw updateError;
      }

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["things-grouped"] });
    },
  });
}

export function useDeleteThing() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("things").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["things-grouped"] });
    },
  });
}

export function useSendToTray(moveId: string | undefined) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (thingId: string) => {
      if (!moveId) throw new Error("No current move");
      const { error } = await (supabase as unknown as PlacementsTable).from("placements").upsert(
        {
          thing_id: thingId,
          move_id: moveId,
          room_id: null,
          x_cm: null,
          y_cm: null,
          rotation_deg: 0,
          // The arrow's whole purpose is "send to tray" — unlike a plain
          // drag to Things' own Unassigned zone, this is always explicit.
          in_tray: true,
        },
        { onConflict: "thing_id,move_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      // Things world's own grouped list *and* Hizzel world's tray both read
      // this same placement change — usePlaceItem (the reverse direction,
      // Hizzel → tray) invalidates both keys already; this was only doing
      // the first half, leaving Hizzel's tray stale until something else
      // happened to refetch it.
      queryClient.invalidateQueries({ queryKey: ["things-grouped"] });
      queryClient.invalidateQueries({ queryKey: ["move-items", moveId] });
    },
  });
}
