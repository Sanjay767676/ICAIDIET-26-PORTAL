-- Migration 0041: Certificate-ready author details, submitted by authors once.
--
-- The original authors table only had name / phone / email / college, which is
-- not enough to print a correct certificate. Title and designation are stored
-- per author, and `authors_finalised_at` locks the list after the author has
-- confirmed it (NULL = still editable).
--
-- `author_edits_enabled` is deliberately seeded to 'false': the admin switch
-- is OFF by default and INSERT OR IGNORE never overrides an admin-saved value.

ALTER TABLE authors ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE authors ADD COLUMN designation TEXT NOT NULL DEFAULT '';

ALTER TABLE submissions ADD COLUMN authors_finalised_at TEXT;

INSERT OR IGNORE INTO settings (key, value) VALUES ('author_edits_enabled', 'false');
