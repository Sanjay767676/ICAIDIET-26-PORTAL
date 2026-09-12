-- ====================================================
-- Migration 0010: Expand submission status values
-- Adds two new workflow statuses used by the admin:
--   READY_FOR_REGISTRATION   ("Ready for Registration")
--   READY_FOR_CAMERA_READY   ("Ready for Camera Ready")
-- The old CHECK constraint only allowed
-- DRAFT/SUBMITTED/UNDER_REVIEW/REVISION_REQUIRED/ACCEPTED/REJECTED,
-- so the submissions table must be rebuilt with the wider CHECK.
--
-- D1 enforces foreign keys (ON + CASCADE), so the parent table is
-- NOT dropped while children still reference it. Order of operations:
--   1) create the new tables (*_next)
--   2) copy data into them
--   3) drop children first (no table references them), then the parent
--   4) rename the *_next tables into place.
-- ====================================================

PRAGMA defer_foreign_keys = on;

-- 1. Rebuild `submissions` with the expanded status CHECK.
CREATE TABLE submissions_next (
  id TEXT PRIMARY KEY,
  submission_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL,
  keywords TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN (
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'REVISION_REQUIRED',
    'ACCEPTED',
    'REJECTED',
    'READY_FOR_REGISTRATION',
    'READY_FOR_CAMERA_READY'
  )),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  track TEXT DEFAULT '',
  author_name TEXT DEFAULT '',
  author_email TEXT DEFAULT '',
  paper_id TEXT DEFAULT '',
  deleted_at TEXT
);

INSERT INTO submissions_next (id, submission_code, title, abstract, keywords, user_id, status, created_at, updated_at, track, author_name, author_email, paper_id, deleted_at)
SELECT id, submission_code, title, abstract, keywords, user_id, status, created_at, updated_at, track, author_name, author_email, paper_id, deleted_at
FROM submissions;

-- 2. Rebuild `submission_files` pointing at submissions_next.
CREATE TABLE submission_files_next (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions_next(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK(file_type IN ('MANUSCRIPT', 'SUPPORTING', 'PLAGIARISM')),
  original_filename TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL
);

INSERT INTO submission_files_next (id, submission_id, file_type, original_filename, storage_key, mime_type, file_size, uploaded_at)
SELECT id, submission_id, file_type, original_filename, storage_key, mime_type, file_size, uploaded_at
FROM submission_files;

-- 3. Rebuild `authors` pointing at submissions_next.
CREATE TABLE authors_next (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions_next(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  college TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

INSERT INTO authors_next (id, submission_id, is_primary, first_name, last_name, phone, email, college, created_at)
SELECT id, submission_id, is_primary, first_name, last_name, phone, email, college, created_at
FROM authors;

-- 4. Drop the old tables. Children have no referencers and can go first;
--    by the time `submissions` is dropped nothing references it.
DROP TABLE submission_files;
DROP TABLE authors;
DROP TABLE submissions;

-- 5. Rename the new tables into place.
ALTER TABLE submissions_next RENAME TO submissions;
ALTER TABLE submission_files_next RENAME TO submission_files;
ALTER TABLE authors_next RENAME TO authors;

-- 6. Recreate the performance indexes.
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_code ON submissions(submission_code);
CREATE INDEX IF NOT EXISTS idx_submissions_deleted_at ON submissions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_submission_files_submission_id ON submission_files(submission_id);
CREATE INDEX IF NOT EXISTS idx_authors_submission_id ON authors(submission_id);