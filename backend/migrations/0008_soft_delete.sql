-- ====================================================
-- Migration 0008: Soft delete support
-- - Adds deleted_at to submissions for the admin
--   "Deleted Files" tab (soft delete + recover).
-- - Records are permanently purged after 30 days via a
--   Cron trigger on the worker.
-- ====================================================

ALTER TABLE submissions ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_submissions_deleted_at ON submissions(deleted_at);