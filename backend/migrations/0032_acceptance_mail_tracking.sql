-- ============================================================
-- Migration 0032: Automatic acceptance mail tracking
--
-- Adds the exactly-once latch for the automatic acceptance mail. The mail
-- fires the moment a paper ENTERS an accepted state (reviewer decision
-- ACCEPTED, or an admin status change into READY_FOR_REGISTRATION /
-- READY_FOR_CAMERA_READY). The UPDATE that claims this column only matches
-- while it is NULL, so concurrent triggers can never send twice.
--
-- Deliberately NOT backfilled: papers already accepted before this feature
-- existed keep NULL and are never mailed retroactively — they never pass
-- through an into-accepted transition again, so nothing ever claims them.
-- ============================================================

ALTER TABLE submissions ADD COLUMN acceptance_mail_sent_at TEXT;
