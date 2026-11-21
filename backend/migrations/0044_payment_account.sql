-- Migration 0044: record which bank account a registration payment arrived in.
-- Stored on the submission so each payment can be reconciled independently.
ALTER TABLE submissions ADD COLUMN payment_account TEXT;
