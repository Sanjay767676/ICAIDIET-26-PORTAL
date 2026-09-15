-- ====================================================
-- Migration 0011: Reviewer role + review decisions
-- - Creates the `reviewers` table (portal login accounts)
-- - Seeds the reviewer account: username icaidiet, password review123 (SHA-256)
-- - Creates the `reviews` table storing per-paper review decisions
--   and the mandatory feedback when a paper is NOT_ACCEPTED.
-- ====================================================

CREATE TABLE IF NOT EXISTS reviewers (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO reviewers (id, username, name, email, password_hash, created_at, updated_at)
VALUES (
  'reviewer-icaidiet',
  'icaidiet',
  'Reviewer',
  'icaidiet.reviewer@snsct.org',
  '7ad8ef4141484d807e3b171c42f49110f799cfe5ab79b01cbce28387603f806f',
  datetime('now'),
  datetime('now')
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES reviewers(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK(decision IN ('ACCEPTED', 'NOT_ACCEPTED')),
  feedback TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(submission_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_submission_id ON reviews(submission_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);