import { IconDoor, IconWindow, type Icon } from "@tabler/icons-react";
import type { StructuralType } from "@/lib/supabase/types";

export const STRUCTURAL_ICONS: Record<StructuralType, Icon> = {
  door: IconDoor,
  window: IconWindow,
};
