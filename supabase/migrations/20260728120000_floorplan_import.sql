-- AI floor-plan extraction (Phase 7): imports a reviewed, user-confirmed set
-- of rooms into an area — either a fresh area, or replacing an existing
-- floor plan's rooms wholesale. Deliberately NOT security definer: it runs
-- as the calling user, so the existing RLS policies on areas/rooms enforce
-- ownership exactly as if these statements were sent directly from the
-- client (unlike seed_example_content, which legitimately needs elevated
-- privilege to seed a brand-new user during signup).
--
-- Deleting the old rooms on a replace automatically returns their placed
-- items to the tray — placements.room_id is `references rooms(id) on
-- delete set null`, so nothing extra is needed here for that.

create function public.import_floor_plan(
  p_property_id uuid,
  p_area_id uuid,       -- null = fresh import, creates a new area
  p_area_name text,
  p_rooms jsonb         -- [{name, width_cm, depth_cm, x_cm, y_cm}, ...]
)
returns uuid
language plpgsql
as $$
declare
  v_area_id uuid := p_area_id;
  v_room jsonb;
  v_next_sort int;
begin
  if v_area_id is not null then
    delete from rooms where area_id = v_area_id;
    update areas set name = p_area_name where id = v_area_id;
  else
    select coalesce(max(sort_order), -1) + 1 into v_next_sort
    from areas where property_id = p_property_id;

    insert into areas (property_id, name, sort_order)
    values (p_property_id, p_area_name, v_next_sort)
    returning id into v_area_id;
  end if;

  for v_room in select * from jsonb_array_elements(p_rooms)
  loop
    insert into rooms (area_id, name, width_cm, depth_cm, canvas_x, canvas_y)
    values (
      v_area_id,
      v_room->>'name',
      (v_room->>'width_cm')::numeric,
      (v_room->>'depth_cm')::numeric,
      (v_room->>'x_cm')::numeric,
      (v_room->>'y_cm')::numeric
    );
  end loop;

  return v_area_id;
end;
$$;
