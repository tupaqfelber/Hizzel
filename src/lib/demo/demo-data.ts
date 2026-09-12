// Static scripted content for the "Watch demo" onboarding sequence
// (src/components/demo/demo-player.tsx runs the actual timeline against
// this). Every id here is a fixed string, not a real Supabase uuid — the
// demo never touches the database, see the hook patches in use-current-move.ts
// etc. that short-circuit to this data instead of querying.
import type { MoveProperty, CurrentMove } from "@/hooks/use-current-move";
import type { Area } from "@/hooks/use-areas";
import type { RoomRow } from "@/hooks/use-rooms";
import type { ThingCategory } from "@/lib/supabase/types";

export const DEMO_MOVE_ID = "demo-move";
export const DEMO_AREA_ID = "demo-area";

// Fed through the app's existing useFlashStore (the same one that flashes
// an item/room on a real placement) — every simulated "tap" in the demo
// flashes its real button this same way, rather than the state around it
// just changing with no visual cue that something was pressed.
export const DEMO_MY_HIZZEL_FLASH_ID = "demo-my-hizzel-button";
export const DEMO_NEW_MOVE_FLASH_ID = "demo-new-move-button";
export const DEMO_PLAN_BUTTON_FLASH_ID = "demo-plan-button";
export const DEMO_SHARE_BUTTON_FLASH_ID = "demo-share-button";

export const DEMO_PROPERTIES: MoveProperty[] = [
  {
    id: "demo-property-current",
    role: "current",
    nickname: "Currant House",
    address: "14 Currant Lane",
    photo_url: "/demo/houses/currant-house.jpg",
  },
  {
    id: "demo-property-new",
    role: "new",
    nickname: "Newhome Street",
    address: "2 Newhome Street",
    photo_url: "/demo/houses/newhome-street.jpg",
  },
];

// Everything but `properties` — the script reveals the two homes partway
// through (beat 2), but the rest of the move's own details (date, mover,
// notes) are just there from the start, matching demo_export_pdf_v2.html's
// target PDF content exactly so the demo's final beat and the mockup agree.
export const DEMO_MOVE_BASE: Omit<CurrentMove, "properties"> = {
  id: DEMO_MOVE_ID,
  is_example: false,
  move_date: "2027-06-12",
  notes: "Keys with neighbour at no. 4",
  mover_name: "Reeves",
  mover_phone: "07700 900123",
};

export type DemoRoomKey = "kitchen" | "living" | "bedroom" | "bathroom";

// Flush edge-to-edge (no gap between canvas_x values and the previous
// room's own width) — a real extracted floor plan reads as one joined
// building, not separate tiles floating with gaps between them. Same
// "flush" precedent as the onboarding example move's own seed content
// (Living Room/Bedroom share a wall there too).
export const DEMO_ROOMS: (RoomRow & { key: DemoRoomKey })[] = [
  { key: "kitchen", id: "demo-room-kitchen", area_id: DEMO_AREA_ID, name: "Kitchen", width_cm: 300, depth_cm: 260, canvas_x: 0, canvas_y: 0, rotation_deg: 0 },
  { key: "living", id: "demo-room-living", area_id: DEMO_AREA_ID, name: "Living Room", width_cm: 400, depth_cm: 350, canvas_x: 300, canvas_y: 0, rotation_deg: 0 },
  { key: "bedroom", id: "demo-room-bedroom", area_id: DEMO_AREA_ID, name: "Bedroom", width_cm: 350, depth_cm: 300, canvas_x: 700, canvas_y: 0, rotation_deg: 0 },
  { key: "bathroom", id: "demo-room-bathroom", area_id: DEMO_AREA_ID, name: "Bathroom", width_cm: 200, depth_cm: 180, canvas_x: 1110, canvas_y: 0, rotation_deg: 0 },
];

export const DEMO_AREA: Area = {
  id: DEMO_AREA_ID,
  property_id: "demo-property-new",
  name: "Ground floor",
  sort_order: 0,
  is_locked: true,
};

export interface DemoThingDef {
  id: string;
  name: string;
  category: ThingCategory;
  width_cm: number;
  depth_cm: number;
  height_cm: number;
  photo_url: string;
  // Where it ends up in beat 6 — null (Moving Box) means it's left in
  // Unassigned on purpose, per the brief ("not everything gets placed").
  roomKey: DemoRoomKey | null;
  placement: { x_cm: number; y_cm: number; rotation_deg: number };
}

// Item→room mapping and placement coordinates confirmed with the user,
// checked by hand against each destination room's own width_cm/depth_cm
// above so nothing sits outside its walls or overlaps another item.
export const DEMO_THINGS: DemoThingDef[] = [
  { id: "demo-fridge", name: "Fridge", category: "Appliances", width_cm: 60, depth_cm: 65, height_cm: 180, photo_url: "/demo/things/fridge.jpg", roomKey: "kitchen", placement: { x_cm: 20, y_cm: 20, rotation_deg: 0 } },
  { id: "demo-dining-table", name: "Dining Table", category: "Tables", width_cm: 140, depth_cm: 80, height_cm: 75, photo_url: "/demo/things/dining-table.jpg", roomKey: "kitchen", placement: { x_cm: 120, y_cm: 130, rotation_deg: 0 } },
  { id: "demo-sofa", name: "Sofa", category: "Seating", width_cm: 200, depth_cm: 90, height_cm: 80, photo_url: "/demo/things/sofa.jpg", roomKey: "living", placement: { x_cm: 30, y_cm: 40, rotation_deg: 0 } },
  { id: "demo-coffee-table", name: "Coffee Table", category: "Tables", width_cm: 110, depth_cm: 60, height_cm: 40, photo_url: "/demo/things/coffee-table.jpg", roomKey: "living", placement: { x_cm: 60, y_cm: 160, rotation_deg: 0 } },
  { id: "demo-bookshelf", name: "Bookshelf", category: "Shelving", width_cm: 80, depth_cm: 30, height_cm: 180, photo_url: "/demo/things/bookshelf.jpg", roomKey: "living", placement: { x_cm: 300, y_cm: 30, rotation_deg: 0 } },
  { id: "demo-bed", name: "Bed", category: "Beds", width_cm: 160, depth_cm: 200, height_cm: 40, photo_url: "/demo/things/bed.jpg", roomKey: "bedroom", placement: { x_cm: 30, y_cm: 30, rotation_deg: 0 } },
  { id: "demo-wardrobe", name: "Wardrobe", category: "Storage", width_cm: 120, depth_cm: 60, height_cm: 200, photo_url: "/demo/things/wardrobe.jpg", roomKey: "bedroom", placement: { x_cm: 210, y_cm: 20, rotation_deg: 0 } },
  { id: "demo-bedside-table", name: "Bedside Table", category: "Tables", width_cm: 40, depth_cm: 40, height_cm: 55, photo_url: "/demo/things/bedside-table.jpg", roomKey: "bedroom", placement: { x_cm: 200, y_cm: 230, rotation_deg: 0 } },
  { id: "demo-storage-cabinet", name: "Storage Cabinet", category: "Storage", width_cm: 50, depth_cm: 35, height_cm: 90, photo_url: "/demo/things/storage-cabinet.jpg", roomKey: "bathroom", placement: { x_cm: 20, y_cm: 20, rotation_deg: 0 } },
  { id: "demo-moving-box", name: "Moving Box", category: "Boxes", width_cm: 45, depth_cm: 45, height_cm: 45, photo_url: "/demo/things/moving-box.jpg", roomKey: null, placement: { x_cm: 0, y_cm: 0, rotation_deg: 0 } },
];

// The order items visually place themselves during beat 6 — interleaved
// across rooms rather than strictly grouped, so it reads as "several
// things happening" rather than one room at a time. Moving Box is
// deliberately absent — it never places.
export const DEMO_PLACEMENT_ORDER = [
  "demo-fridge",
  "demo-sofa",
  "demo-bed",
  "demo-storage-cabinet",
  "demo-dining-table",
  "demo-coffee-table",
  "demo-wardrobe",
  "demo-bookshelf",
  "demo-bedside-table",
];
