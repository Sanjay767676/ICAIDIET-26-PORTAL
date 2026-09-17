-- Mail templates created by the admin for contacting authors.
CREATE TABLE IF NOT EXISTS mail_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Log of mails sent to authors (Resend queue + delivery tracking).
-- status: queued -> sending -> delivered | failed
CREATE TABLE IF NOT EXISTS mail_logs (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  template_id TEXT,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  paper_title TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  resend_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mail_logs_submission ON mail_logs(submission_id);
CREATE INDEX IF NOT EXISTS idx_mail_logs_status ON mail_logs(status);