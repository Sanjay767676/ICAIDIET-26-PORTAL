-- ====================================================
-- Migration 0007: Support a plagiarism report file
-- - Expands submission_files.file_type CHECK to allow 'PLAGIARISM'
--   (paper = 'MANUSCRIPT', plagiarism report = 'PLAGIARISM').
-- SQLite cannot alter a CHECK constraint in place, so the
-- table is rebuilt with the wider constraint.
-- ====================================================

CREATE TABLE submission_files_next (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
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

DROP TABLE submission_files;
ALTER TABLE submission_files_next RENAME TO submission_files;

CREATE INDEX IF NOT EXISTS idx_submission_files_submission_id ON submission_files(submission_id);