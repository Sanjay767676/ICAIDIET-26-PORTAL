-- Grant payment access to specific papers by title
CREATE TABLE IF NOT EXISTS payment_access_grants (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  paper_title TEXT,
  granted_by TEXT,
  granted_at TEXT DEFAULT (datetime('now')),
  UNIQUE(submission_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_access_grants_submission ON payment_access_grants(submission_id);
