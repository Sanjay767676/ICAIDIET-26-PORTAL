-- ============================================================
-- Migration 0033: Copyright form + camera-ready file types
--
-- Adds 'COPYRIGHT_FORM' and 'CAMERA_READY' to the submission_files CHECK so
-- the two final-phase deliverables of an accepted paper (the signed
-- copyright form and the camera-ready manuscript) can be stored per
-- submission, following the same widening pattern as 0007 and 0014.
-- One row per type per submission is enforced by the production queries,
-- not by a unique index (unchanged from 0014).
--
-- DROP TABLE also drops both indexes on the old table, so they are
-- recreated here: idx_submission_files_submission_id (0001) and
-- idx_submission_files_sub_type (0026), which the admin/reviewer list
-- subqueries depend on.
-- ============================================================

PRAGMA defer_foreign_keys = on;

CREATE TABLE submission_files_next (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK(file_type IN ('MANUSCRIPT', 'SUPPORTING', 'PLAGIARISM', 'AI_PLAGIARISM', 'COPYRIGHT_FORM', 'CAMERA_READY')),
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
CREATE INDEX IF NOT EXISTS idx_submission_files_sub_type
  ON submission_files (submission_id, file_type);
