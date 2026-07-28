import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { ExtractResponse, ExtractedRoom } from "@/app/api/floorplan/extract/route";

export type { ExtractResponse, ExtractedFloor, ExtractedRoom } from "@/app/api/floorplan/extract/route";

export function useExtractFloorPlan() {
  return useMutation({
    mutationFn: async (file: File): Promise<ExtractResponse> => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/floorplan/extract", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Extraction failed");
      return body as ExtractResponse;
    },
  });
}

interface ImportInput {
  propertyId: string;
  areaId: string | null;
  areaName: string;
  rooms: ExtractedRoom[];
}

// `import_floor_plan` isn't in the generated Database type yet — it's
// created by a migration (supabase/migrations/20260728120000_floorplan_import.sql)
// that hasn't been applied to the live project. Once it's applied, regenerate
// src/lib/supabase/types.ts (`supabase gen types typescript --linked`) and
// delete this interface + cast in favor of calling supabase.rpc directly,
// same as every other hook in this codebase.
interface FloorPlanRpc {
  rpc(
    fn: "import_floor_plan",
    args: { p_property_id: string; p_area_id: string | null; p_area_name: string; p_rooms: ExtractedRoom[] },
  ): Promise<{ data: string | null; error: { message: string } | null }>;
}

export function useImportFloorPlan(moveId: string | undefined) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ImportInput) => {
      const { data, error } = await (supabase as unknown as FloorPlanRpc).rpc("import_floor_plan", {
        p_property_id: input.propertyId,
        p_area_id: input.areaId,
        p_area_name: input.areaName,
        p_rooms: input.rooms,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      // A replace can null out room_id on placements (back to the tray).
      queryClient.invalidateQueries({ queryKey: ["move-items", moveId] });
    },
  });
}
