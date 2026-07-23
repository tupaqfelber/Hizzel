-- Onboarding: an `onboarded` flag gates the one-time Welcome screen, and every
-- new user is seeded with an example move ("Hizzel Now -> Hizzel New", per the
-- welcome copy) so they land somewhere populated on first login.

alter table profiles add column onboarded boolean not null default false;

create function public.seed_example_content(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_move_id uuid;
  v_new_property_id uuid;
  v_area_id uuid;
  v_room_living uuid;
  v_room_bedroom uuid;
  v_thing_id uuid;
  v_things jsonb := '[
    {"name": "Sofa",          "category": "Seating",   "w": 200, "d": 90,  "h": 80,  "room": "living",  "x": 40,  "y": 40,  "rot": 0},
    {"name": "Armchair",      "category": "Seating",   "w": 80,  "d": 85,  "h": 90,  "room": "living",  "x": 260, "y": 40,  "rot": 0},
    {"name": "Coffee Table",  "category": "Tables",    "w": 100, "d": 50,  "h": 40,  "room": "living",  "x": 100, "y": 160, "rot": 0},
    {"name": "Bookshelf",     "category": "Shelving",  "w": 80,  "d": 30,  "h": 180, "room": "living",  "x": 10,  "y": 250, "rot": 0},
    {"name": "Floor Lamp",    "category": "Lighting",  "w": 30,  "d": 30,  "h": 150, "room": "living",  "x": 320, "y": 250, "rot": 0},
    {"name": "Bed Frame",     "category": "Beds",      "w": 160, "d": 200, "h": 40,  "room": "bedroom", "x": 30,  "y": 30,  "rot": 0},
    {"name": "Wardrobe",      "category": "Storage",   "w": 120, "d": 60,  "h": 200, "room": "bedroom", "x": 210, "y": 20,  "rot": 0},
    {"name": "Desk",          "category": "Tables",    "w": 120, "d": 60,  "h": 75,  "room": null,      "x": null,"y": null,"rot": 0},
    {"name": "Moving Box",    "category": "Boxes",     "w": 45,  "d": 45,  "h": 60,  "room": null,      "x": null,"y": null,"rot": 0},
    {"name": "Table Lamp",    "category": "Lighting",  "w": 20,  "d": 20,  "h": 45,  "room": null,      "x": null,"y": null,"rot": 0}
  ]'::jsonb;
  v_item jsonb;
  v_room_id uuid;
begin
  insert into moves (user_id, status, is_example)
  values (p_user_id, 'current', true)
  returning id into v_move_id;

  insert into properties (move_id, role, nickname, address)
  values (v_move_id, 'current', 'Hizzel Now', '');

  insert into properties (move_id, role, nickname, address)
  values (v_move_id, 'new', 'Hizzel New', '')
  returning id into v_new_property_id;

  insert into areas (property_id, name, sort_order)
  values (v_new_property_id, 'Ground floor', 0)
  returning id into v_area_id;

  insert into rooms (area_id, name, width_cm, depth_cm, canvas_x, canvas_y)
  values (v_area_id, 'Living Room', 400, 350, 0, 0)
  returning id into v_room_living;

  insert into rooms (area_id, name, width_cm, depth_cm, canvas_x, canvas_y)
  values (v_area_id, 'Bedroom', 350, 300, 420, 0)
  returning id into v_room_bedroom;

  for v_item in select * from jsonb_array_elements(v_things)
  loop
    insert into things (user_id, name, category, width_cm, depth_cm, height_cm)
    values (
      p_user_id,
      v_item->>'name',
      (v_item->>'category')::thing_category,
      (v_item->>'w')::numeric,
      (v_item->>'d')::numeric,
      (v_item->>'h')::numeric
    )
    returning id into v_thing_id;

    v_room_id := case v_item->>'room'
      when 'living' then v_room_living
      when 'bedroom' then v_room_bedroom
      else null
    end;

    insert into placements (thing_id, move_id, room_id, x_cm, y_cm, rotation_deg)
    values (
      v_thing_id,
      v_move_id,
      v_room_id,
      (v_item->>'x')::numeric,
      (v_item->>'y')::numeric,
      (v_item->>'rot')::numeric
    );
  end loop;
end;
$$;

-- Only the trigger (running as the function owner) should invoke this —
-- without this revoke, Postgres grants EXECUTE to PUBLIC by default, which
-- would let any authenticated user seed duplicate content into another
-- user's account via RPC.
revoke execute on function public.seed_example_content(uuid) from public;

-- Extend the existing signup trigger to also seed example content.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);

  perform public.seed_example_content(new.id);

  return new;
end;
$$;
