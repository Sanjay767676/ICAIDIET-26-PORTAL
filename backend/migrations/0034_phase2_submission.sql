-- Phase 2 (camera-ready + copyright) submission record.
--
-- A paper enters the admin's Camera Ready tab (and leaves the Payments tab)
-- the moment phase2_submitted_at is set; attendance_mode + declaration_confirmed
-- record the compulsory fields of the author's Phase 2 form. All NULL / 0
-- until each author submits — no backfill, existing rows untouched.
ALTER TABLE submissions ADD COLUMN attendance_mode TEXT;
ALTER TABLE submissions ADD COLUMN declaration_confirmed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN phase2_submitted_at TEXT;
