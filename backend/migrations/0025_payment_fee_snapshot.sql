-- Snapshots the registration fee an author was actually shown and charged at the
-- moment they registered.
--
-- Why a snapshot and not a lookup: `registration_config` (the admin-editable fee
-- matrix) is mutable. If the export derived "how much was paid" from the current
-- matrix, a later price edit would silently rewrite what every historical payment
-- record says was collected. These two columns are written once, when the author
-- registers, and are never recomputed.
--
-- fee_amount is the free-text display string exactly as configured
-- ('₹2,000', '$350') -- the same convention the fee matrix already uses, so the
-- admin sees the symbol and grouping they typed. It is never summed or parsed.
--
-- fee_tier records which bracket was applied so a row is still meaningful if the
-- matrix is later edited. 'EARLY' | 'STANDARD'. NULL for submissions registered
-- before this migration, and for papers that never registered.
ALTER TABLE submissions ADD COLUMN fee_amount TEXT;
ALTER TABLE submissions ADD COLUMN fee_tier TEXT;

-- The export's "Payment Made" filter and the admin payments tab both need to find
-- rows by payment state without a table scan. payment_status alone is not enough
-- because it is NULL (not 'PANCELLED') for papers that never paid.
CREATE INDEX IF NOT EXISTS idx_submissions_payment_status ON submissions (payment_status);
