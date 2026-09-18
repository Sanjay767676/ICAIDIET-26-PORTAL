-- ====================================================
-- Migration 0018: Expand review decision options
-- Adds two new review decisions used by the reviewer:
--   ACCEPTED_WITH_MINOR_CHANGES
--   ACCEPTED_WITH_MAJOR_CHANGES
-- The old CHECK constraint only allowed ACCEPTED/NOT_ACCEPTED,
-- so the reviews table must be rebuilt with the wider CHECK.
--
-- Nothing references `reviews` (mail_logs spans submissions only),
-- so we can drop it and rename the rebuilt table into place.
-- ====================================================

PRAGMA defer_foreign_keys = on;

CREATE TABLE reviews_next (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES reviewers(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK(decision IN (
    'ACCEPTED',
    'ACCEPTED_WITH_MINOR_CHANGES',
    'ACCEPTED_WITH_MAJOR_CHANGES',
    'NOT_ACCEPTED'
  )),
  feedback TEXT NOT NULL DEFAULT '',
  resubmitted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(submission_id, reviewer_id)
);

INSERT INTO reviews_next (id, submission_id, reviewer_id, decision, feedback, resubmitted, created_at, updated_at)
SELECT id, submission_id, reviewer_id, decision, feedback, resubmitted, created_at, updated_at
FROM reviews;

-- Drop the old table, then rename the new one into place.
DROP TABLE reviews;
ALTER TABLE reviews_next RENAME TO reviews;

-- Recreate the performance indexes.
CREATE INDEX IF NOT EXISTS idx_reviews_submission_id ON reviews(submission_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);