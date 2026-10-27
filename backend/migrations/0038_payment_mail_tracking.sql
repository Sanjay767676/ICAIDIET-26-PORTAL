-- Migration 0038: Dedicated payment mail tracking
-- Adds payment_mail_status and payment_mail_sent_at to submissions so that
-- the payment confirmation email lifecycle is tracked independently from the earlier acceptance email.

ALTER TABLE submissions ADD COLUMN payment_mail_status TEXT;
ALTER TABLE submissions ADD COLUMN payment_mail_sent_at TEXT;

-- Prefill the 166 pre-existing approved submissions with mail delivered at 27.10.2026 10:00 AM IST (04:30 UTC)
UPDATE submissions
SET payment_mail_status = 'delivered',
    payment_mail_sent_at = '2026-10-27T04:30:00.000Z'
WHERE payment_status = 'APPROVED'
  AND (payment_approved_at IS NULL OR payment_approved_at <= '2026-10-27T05:00:00.000Z');
