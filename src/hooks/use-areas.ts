import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useDemoStore } from "@/hooks/use-demo-store";

export interface Area {
  id: string;
  property_id: string;
  name: string;
  sort_order: number;
  is_locked: boolean;
}

export function useAreas(propertyId: string | undefined) {
  const supabase = createClient();
  const demo = useDemoStore((s) => s.active);
  const demoAreas = useDemoStore((s) => s.areas);

  const query = useQuery({
    queryKey: ["areas", propertyId],
    enabled: !!propertyId && !demo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("areas")
        .select("id, property_id, name, sort_order, is_locked")
        .eq("property_id", propertyId!)
        .order("sort_order");
      if (error) throw error;
      return data as Area[];
    },
  });

  if (demo) {
    return { ...query, data: demoAreas, isLoading: false, isPending: false, isError: false, error: null } as typeof query;
  }
  return query;
}

export function useCreateArea(propertyId: string | undefined) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!propertyId) throw new Error("No property");
      const { data: existing } = await supabase
        .from("areas")
        .select("sort_order")
        .eq("property_id", propertyId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextOrder = (existing?.sort_order ?? -1) + 1;

      const { data, error } = await supabase
        .from("areas")
        .insert({ property_id: propertyId, name, sort_order: nextOrder })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas", propertyId] });
    },
  });
}

export function useUpdateArea(propertyId: string | undefined) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      sort_order?: number;
      is_locked?: boolean;
    }) => {
      const { id, ...changes } = input;
      const { error } = await supabase.from("areas").update(changes).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas", propertyId] });
    },
  });
}

export function useDeleteArea(propertyId: string | undefined) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("areas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas", propertyId] });
    },
  });
}
