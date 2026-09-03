-- ====================================================
-- Migration 0003: Add CMT paper ID column
-- - Stores the Paper ID that the author entered from the
--   CMT portal during submission.
-- ====================================================

ALTER TABLE submissions ADD COLUMN paper_id TEXT DEFAULT '';