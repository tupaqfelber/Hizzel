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
  // Grouping key: the room's own id, or the UNASSIGNED sentinel. Never the
  // room's name alone — a multi-floor property routinely has same-named
  // rooms on different floors (two "Landing"s, two "Shower Room"s), and
  // grouping by name would silently merge their items into one group.
  key: string;
  roomName: string;
  // The room's floor/area name, shown alongside roomName so two same-named
  // rooms on different floors read as distinct groups. Null for Unassigned.
  areaName: string | null;
  // The area's own sort_order (matches Hizzel's floor ordering) — carried
  // per-group rather than looked up by room/area name afterwards, since
  // room names aren't unique across floors either.
  areaSortOrder: number;
  // Null for Unassigned. Lets a group's own heading act as a drop target
  // in ThingsWorld's cross-room drag — dropping there needs the room's
  // real dimensions to run the same fit-check/collision logic a canvas
  // drop does, even though there's no on-screen position to derive from.
  roomWidthCm: number | null;
  roomDepthCm: number | null;
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
          .select("thing_id, room_id, rooms(name, width_cm, depth_cm, areas(name, sort_order))")
          .eq("move_id", moveId!),
      ]);

      if (thingsRes.error) throw thingsRes.error;
      if (placementsRes.error) throw placementsRes.error;

      const placementByThing = new Map(
        placementsRes.data.map((p) => [p.thing_id, p]),
      );

      const groupsByKey = new Map<string, ThingGroup>();
      // Seeded up front, even with zero items — Unassigned is now the only
      // place to retrieve something dragged out of a room (Hizzel's own
      // tray is disabled, see hizzel-world.tsx), so it needs to always be
      // a real, visible drop target, not just appear once something has
      // already landed there.
      if (thingsRes.data.length > 0) {
        groupsByKey.set(UNASSIGNED, {
          key: UNASSIGNED,
          roomName: UNASSIGNED,
          areaName: null,
          areaSortOrder: 0,
          roomWidthCm: null,
          roomDepthCm: null,
          items: [],
        });
      }
      for (const thing of thingsRes.data) {
        const placement = placementByThing.get(thing.id);
        const roomId = placement?.room_id ?? null;
        const key = roomId ?? UNASSIGNED;
        const roomName = roomId ? (placement?.rooms?.name ?? UNASSIGNED) : UNASSIGNED;
        const areaName = roomId ? (placement?.rooms?.areas?.name ?? null) : null;
        const areaSortOrder = roomId ? (placement?.rooms?.areas?.sort_order ?? 0) : 0;
        const roomWidthCm = roomId ? (placement?.rooms?.width_cm ?? null) : null;
        const roomDepthCm = roomId ? (placement?.rooms?.depth_cm ?? null) : null;

        if (!groupsByKey.has(key)) {
          groupsByKey.set(key, {
            key,
            roomName,
            areaName,
            areaSortOrder,
            roomWidthCm,
            roomDepthCm,
            items: [],
          });
        }
        groupsByKey.get(key)!.items.push({
          ...thing,
          roomId,
        });
      }

      // Unassigned leads — it's the to-do pile — then rooms floor-by-floor
      // (areas' own sort_order, matching Hizzel's floor tabs) and
      // alphabetically by room name within a floor.
      const groups = [...groupsByKey.values()].sort((a, b) => {
        if (a.roomName === UNASSIGNED) return -1;
        if (b.roomName === UNASSIGNED) return 1;
        if (a.areaSortOrder !== b.areaSortOrder) return a.areaSortOrder - b.areaSortOrder;
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
