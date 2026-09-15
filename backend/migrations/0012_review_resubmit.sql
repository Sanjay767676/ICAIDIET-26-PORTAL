-- ====================================================
-- Migration 0012: Review resubmission tracking
-- Adds `resubmitted` flag to reviews so that when an
-- author re-uploads corrected files after a NOT_ACCEPTED
-- review, the paper moves back to the reviewer's
-- "To Review" list while the feedback stays stored.
-- ====================================================

ALTER TABLE reviews ADD COLUMN resubmitted INTEGER NOT NULL DEFAULT 0;