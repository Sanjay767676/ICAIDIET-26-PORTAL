-- Migration 0037: Add camera_ready_resubmitted and prefill mail logs for approved payments

ALTER TABLE submissions ADD COLUMN camera_ready_resubmitted INTEGER DEFAULT 0;

-- Prefill mail_logs for every approved payment (166 submissions)
-- Set status = 'delivered' and sent on = 2026-10-27T04:30:00.000Z (27.10.2026 10:00 AM IST)
INSERT OR REPLACE INTO mail_logs (
  id,
  submission_id,
  template_id,
  recipient_name,
  recipient_email,
  paper_title,
  subject,
  body,
  status,
  created_at,
  updated_at
)
SELECT
  'seed-pay-' || s.id,
  s.id,
  NULL,
  COALESCE(s.author_name, 'Author'),
  COALESCE(s.author_email, ''),
  COALESCE(s.title, 'Submission'),
  'Registration Payment Approved',
  'Your registration payment has been verified and approved.',
  'delivered',
  '2026-10-27T04:30:00.000Z',
  '2026-10-27T04:30:00.000Z'
FROM submissions s
WHERE s.payment_status = 'APPROVED'
  AND s.deleted_at IS NULL;
