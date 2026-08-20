-- "+ New move" (My Hizzel overlay): archives the caller's current move and
-- creates a fresh one with two blank properties, atomically. Deliberately
-- NOT security definer — same reasoning as import_floor_plan: it runs as
-- the calling user, so the existing RLS policies on moves/properties (both
-- keyed off auth.uid()) constrain every statement here exactly as if they'd
-- been sent from the client directly. No p_user_id parameter is needed or
-- wanted: auth.uid() inside a non-security-definer function already
-- resolves to the authenticated caller, and passing it explicitly would
-- just be a spoofable parameter a malicious caller could set to someone
-- else's id — RLS would still block the cross-user write, but there's no
-- reason to open that door when auth.uid() gives us the right value for
-- free.
--
-- Runs as a single function body, i.e. one implicit transaction: if the
-- insert of either property fails, the archive of the old move and the
-- insert of the new move roll back too. This is what guarantees exactly
-- one row with status = 'current' per user at every commit boundary, even
-- though the schema has no unique/partial-unique constraint enforcing that.

create function public.start_new_move()
returns uuid
language plpgsql
as $$
declare
  v_new_move_id uuid;
begin
  update moves
  set status = 'archived'
  where user_id = auth.uid() and status = 'current';

  insert into moves (user_id, status)
  values (auth.uid(), 'current')
  returning id into v_new_move_id;

  insert into properties (move_id, role, nickname, address)
  values (v_new_move_id, 'current', 'Current Home', '');

  insert into properties (move_id, role, nickname, address)
  values (v_new_move_id, 'new', 'New Home', '');

  return v_new_move_id;
end;
$$;
