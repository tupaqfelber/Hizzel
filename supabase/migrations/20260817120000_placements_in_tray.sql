-- Distinguishes "explicitly sent to the tray" from merely "unassigned".
-- room_id: null alone can't carry this distinction — it's identical whether
-- a thing has never been touched, was dragged straight to Hizzel's tray, or
-- was just moved back to Unassigned within Things world (a gesture that
-- should NOT clutter the tray). in_tray is the explicit signal: true only
-- when the user took an action whose actual intent was "send to tray" (the
-- arrow, or a drop landing on Hizzel's tray strip / Mid panel), false for
-- everything else including a never-placed thing and a plain
-- drag-to-Unassigned within Things.
--
-- Default false so existing room_id: null rows (accumulated from testing,
-- long before this distinction existed) don't retroactively flood the tray —
-- they'll simply need to be sent to the tray again explicitly, which is the
-- correct state for data nobody deliberately tray'd.

alter table placements add column in_tray boolean not null default false;
