-- Lets an admin close file replacement for existing submissions without taking
-- the whole user portal into maintenance.
--
-- Polarity: 'true' = authors may replace files, 'false' = blocked. An ABSENT
-- key also means allowed, so a missing setting can never silently block an
-- author mid-revision -- the backend treats anything other than 'false' as open.
-- Seeded explicitly so production does not rely on that fallback.
--
-- Read at the top of POST /api/submissions/:id/files, alongside the existing
-- maintenance gate. Independent of maintenance_user_enabled: an admin can stop
-- file edits while still accepting new submissions, or the reverse.
INSERT INTO settings (key, value) VALUES ('file_edits_enabled', 'true')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
