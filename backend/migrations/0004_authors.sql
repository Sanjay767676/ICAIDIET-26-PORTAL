-- ====================================================
-- Migration 0004: Authors table (multi-author submissions)
-- - Each submission can have 2-6 authors.
-- - The first author (is_primary = 1) is the primary/corresponding author.
-- - Stored per author: first_name, last_name, phone, email, college.
-- ====================================================

CREATE TABLE IF NOT EXISTS authors (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  college TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_authors_submission_id ON authors(submission_id);