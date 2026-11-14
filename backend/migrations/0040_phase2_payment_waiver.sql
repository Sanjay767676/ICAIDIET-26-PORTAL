-- Let the organizers move an individual paper into Phase 2 (camera-ready)
-- without an APPROVED registration payment. Kept separate from payment_status
-- so the admin Payments tab keeps reporting the real payment state and the
-- waiver is always visible as its own flag.
ALTER TABLE submissions ADD COLUMN phase2_payment_waived INTEGER NOT NULL DEFAULT 0;
