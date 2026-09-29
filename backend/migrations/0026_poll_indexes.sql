-- Cuts D1 rows_read on the admin and reviewer panel polls.
--
-- Both panels run a single query over every live submission that carries several
-- correlated subqueries per row (9 in total: 3x submission_files, 4x reviews,
-- 2x mail_logs). Each one was matching on submission_id alone and then sorting
-- on a second column to reach its `ORDER BY ... DESC LIMIT 1` -- so SQLite
-- fetched the matching table rows and sorted them on every single lookup,
-- 9 times per submission.
--
-- These composite indexes put the sort column inside the index, so each of those
-- subqueries is satisfied by the index directly with no table fetch and no sort.
-- The existing single-column indexes are left in place: SQLite keeps using them
-- for the `WHERE submission_id = ?` half of the same lookups, and dropping them
-- would be a regression risk for no measurable gain.
--
-- Measured on production before this migration: 6,140 rows read for a single
-- GET /api/admin/submissions at 289 live submissions.
CREATE INDEX IF NOT EXISTS idx_reviews_sub_updated
  ON reviews (submission_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_mail_logs_sub_created
  ON mail_logs (submission_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submission_files_sub_type
  ON submission_files (submission_id, file_type);
