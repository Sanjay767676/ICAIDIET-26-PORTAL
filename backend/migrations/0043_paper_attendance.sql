-- Migration 0043: ICAIDIET'26 paper attendance (one secret QR per offline paper)
--
-- paper_attendance_qr : one QR per offline paper. qr_token is the paper's own
--                       random secret; qr_payload is the full QR text
--                       (ICD26.<token>.<signature>) that the user portal shows.
--                       The signature is made with the Worker's secret key, so
--                       the Worker fills qr_payload (hourly cron + first view);
--                       SQL alone cannot mint a scannable QR.
-- paper_attendance    : one row per paper once attendance is marked. The
--                       PRIMARY KEY makes a paper markable exactly once, even
--                       with several scanners working at the same time.
--                       authors_json keeps each author's PRESENT / ABSENT.
-- attendance_scan_log : every scan / mark attempt (accepted or rejected) for
--                       later analysis.
-- No FOREIGN KEYs: the author editor deletes and re-inserts author rows.

CREATE TABLE IF NOT EXISTS paper_attendance_qr (
  submission_id TEXT PRIMARY KEY,
  qr_token TEXT UNIQUE NOT NULL,
  qr_payload TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS paper_attendance (
  submission_id TEXT PRIMARY KEY,
  paper_id TEXT,
  title TEXT,
  head_count INTEGER,
  author_count INTEGER NOT NULL,
  presented_count INTEGER NOT NULL,
  authors_json TEXT NOT NULL,
  colleges TEXT,
  marked_at TEXT NOT NULL,
  event_day TEXT NOT NULL,
  lat REAL,
  lng REAL,
  accuracy REAL,
  ip TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_paper_attendance_marked ON paper_attendance(marked_at);

CREATE TABLE IF NOT EXISTS attendance_scan_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT,
  result TEXT NOT NULL,
  detail TEXT,
  lat REAL,
  lng REAL,
  accuracy REAL,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_scan_log_created ON attendance_scan_log(created_at);

-- Generate and store a QR token for every offline paper now (plus paper 1271,
-- which attends offline by arrangement). Papers that switch to offline later
-- get theirs on first view.
INSERT OR IGNORE INTO paper_attendance_qr (submission_id, qr_token, created_at)
SELECT id, lower(hex(randomblob(12))), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM submissions
WHERE deleted_at IS NULL AND (attendance_mode = 'OFFLINE' OR paper_id = '1271');
