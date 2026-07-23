-- Hizzel initial schema
-- Users -> Moves (current/archived) -> two Properties per move -> Areas -> Rooms (lock via area)
-- Things belong to the user globally; Placements link a Thing to a specific Move + Room + position.
-- Structural elements (doors/windows) are separate from Things, wall-mounted on a Room.

create type move_status as enum ('current', 'archived');
create type property_role as enum ('current', 'new');
create type thing_category as enum (
  'Appliances', 'Beds', 'Boxes', 'Lighting', 'Other',
  'Seating', 'Shelving', 'Storage', 'Tables'
);
create type structural_type as enum ('door', 'window');
create type wall_side as enum ('n', 'e', 's', 'w');
create type plan_tier as enum ('free', 'paid');

-- profiles ------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  plan_tier plan_tier not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- moves -----------------------------------------------------------------

create table moves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  status move_status not null default 'current',
  move_date date,
  notes text,
  mover_name text,
  mover_phone text,
  is_example boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index moves_user_id_idx on moves (user_id);

-- properties --------------------------------------------------------------

create table properties (
  id uuid primary key default gen_random_uuid(),
  move_id uuid not null references moves (id) on delete cascade,
  role property_role not null,
  nickname text not null,
  address text not null,
  photo_url text,
  created_at timestamptz not null default now(),
  unique (move_id, role)
);

create index properties_move_id_idx on properties (move_id);

-- areas ---------------------------------------------------------------------

create table areas (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_locked boolean not null default false,
  created_at timestamptz not null default now()
);

create index areas_property_id_idx on areas (property_id);

-- rooms ---------------------------------------------------------------------

create table rooms (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references areas (id) on delete cascade,
  name text not null,
  width_cm numeric not null,
  depth_cm numeric not null,
  canvas_x numeric not null default 0,
  canvas_y numeric not null default 0,
  rotation_deg numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rooms_area_id_idx on rooms (area_id);

-- things (the user's global inventory) ---------------------------------------

create table things (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  category thing_category not null default 'Appliances',
  width_cm numeric not null,
  depth_cm numeric not null,
  height_cm numeric not null,
  photo_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index things_user_id_idx on things (user_id);

-- placements (a Thing's assignment within one Move) --------------------------

create table placements (
  id uuid primary key default gen_random_uuid(),
  thing_id uuid not null references things (id) on delete cascade,
  move_id uuid not null references moves (id) on delete cascade,
  room_id uuid references rooms (id) on delete set null,
  x_cm numeric,
  y_cm numeric,
  rotation_deg numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (thing_id, move_id)
);

create index placements_thing_id_idx on placements (thing_id);
create index placements_move_id_idx on placements (move_id);
create index placements_room_id_idx on placements (room_id);

-- structural_elements (doors/windows — never counted as items) ---------------

create table structural_elements (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  type structural_type not null,
  wall_side wall_side not null,
  offset_cm numeric not null,
  width_cm numeric not null,
  created_at timestamptz not null default now()
);

create index structural_elements_room_id_idx on structural_elements (room_id);

-- updated_at maintenance ------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on moves
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on rooms
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on things
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on placements
  for each row execute function public.set_updated_at();

-- Row Level Security -----------------------------------------------------------

alter table profiles enable row level security;
alter table moves enable row level security;
alter table properties enable row level security;
alter table areas enable row level security;
alter table rooms enable row level security;
alter table things enable row level security;
alter table placements enable row level security;
alter table structural_elements enable row level security;

create policy "profiles: read own" on profiles
  for select using (id = auth.uid());
create policy "profiles: update own" on profiles
  for update using (id = auth.uid());

create policy "moves: all own" on moves
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "properties: all via own move" on properties
  for all using (exists (
    select 1 from moves where moves.id = properties.move_id and moves.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from moves where moves.id = properties.move_id and moves.user_id = auth.uid()
  ));

create policy "areas: all via own move" on areas
  for all using (exists (
    select 1 from properties
    join moves on moves.id = properties.move_id
    where properties.id = areas.property_id and moves.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from properties
    join moves on moves.id = properties.move_id
    where properties.id = areas.property_id and moves.user_id = auth.uid()
  ));

create policy "rooms: all via own move" on rooms
  for all using (exists (
    select 1 from areas
    join properties on properties.id = areas.property_id
    join moves on moves.id = properties.move_id
    where areas.id = rooms.area_id and moves.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from areas
    join properties on properties.id = areas.property_id
    join moves on moves.id = properties.move_id
    where areas.id = rooms.area_id and moves.user_id = auth.uid()
  ));

create policy "things: all own" on things
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "placements: all via own move" on placements
  for all using (exists (
    select 1 from moves where moves.id = placements.move_id and moves.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from moves where moves.id = placements.move_id and moves.user_id = auth.uid()
  ));

create policy "structural_elements: all via own move" on structural_elements
  for all using (exists (
    select 1 from rooms
    join areas on areas.id = rooms.area_id
    join properties on properties.id = areas.property_id
    join moves on moves.id = properties.move_id
    where rooms.id = structural_elements.room_id and moves.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from rooms
    join areas on areas.id = rooms.area_id
    join properties on properties.id = areas.property_id
    join moves on moves.id = properties.move_id
    where rooms.id = structural_elements.room_id and moves.user_id = auth.uid()
  ));
