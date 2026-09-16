-- ====================================================
-- Migration 0015: Contact tracking (Enquired checkbox)
-- Adds an `enquired` flag to submissions so admins can
-- track whether the committee has already called each
-- author for updates. The flag is reset to 0 whenever
-- the author re-uploads files, signalling the submission
-- has changed and needs another call.
-- ====================================================

ALTER TABLE submissions ADD COLUMN enquired INTEGER NOT NULL DEFAULT 0;