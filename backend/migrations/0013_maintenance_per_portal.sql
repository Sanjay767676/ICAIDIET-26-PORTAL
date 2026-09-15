-- Migration number: 0013 	 2026-09-15T00:00:00.000Z
-- Per-portal maintenance mode for the User and Reviewer portals.
--   maintenance_user_enabled   - 'true' blocks new submissions in the user portal
--   maintenance_user_until     - optional ISO datetime shown to users ("" = no end)
--   maintenance_review_enabled - 'true' blocks sign-in on the reviewer portal
--   maintenance_review_until   - optional ISO datetime shown to reviewers ("" = no end)

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('maintenance_user_enabled', 'false'),
  ('maintenance_user_until', ''),
  ('maintenance_review_enabled', 'false'),
  ('maintenance_review_until', '');