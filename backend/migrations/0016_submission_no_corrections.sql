-- ====================================================
-- Migration 0016: No Corrections tracking flag
-- Adds a `no_corrections` flag to submissions so admins
-- can track whether each paper requires no further
-- corrections. Mirrors the `enquired` contact flag.
-- ====================================================

ALTER TABLE submissions ADD COLUMN no_corrections INTEGER NOT NULL DEFAULT 0;