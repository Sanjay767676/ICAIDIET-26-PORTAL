-- Migration 0045: author-detail updates go through admin verification.
--
-- An author who submits new certificate details does NOT change the `authors`
-- table straight away. The proposed list is staged here as JSON, the admin
-- compares it with the camera-ready paper, and only an approval writes it to
-- `authors` and sets submissions.authors_finalised_at. A rejection keeps the
-- original authors untouched and reopens the author's Edit Authors button.
--
-- One row per submission: a rejected author can submit a corrected list, which
-- replaces the previous request and goes back to PENDING.

CREATE TABLE IF NOT EXISTS author_detail_requests (
  submission_id TEXT PRIMARY KEY,
  proposed_authors_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  rejection_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_author_detail_requests_status ON author_detail_requests(status);
