-- OCR text extracted from uploaded payment proofs.
--
-- An author can type any UTR they like, but the screenshot they attach is
-- real. Storing the text OCR reads out of each proof lets the admin detect the
-- same screenshot (or the same reference number) being reused across several
-- submissions -- which a UTR-only check can never catch, because a fake UTR
-- plus a borrowed screenshot is otherwise indistinguishable from a real
-- payment.
--
-- Kept in its own table rather than as more columns on `submissions` so the
-- per-submission read that GET /api/admin/submissions performs (which D1 bills
-- per row) is untouched, and so a failed scan can be retried without touching
-- the submission itself.
CREATE TABLE payment_proof_ocr (
  submission_id     TEXT PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
  storage_key       TEXT NOT NULL,
  -- The name of the file the author actually picked. `submissions` only ever
  -- stores the generated R2 key, so this is the first place it is recorded.
  original_filename TEXT,
  ocr_text          TEXT,
  -- Lowercased / punctuation-stripped `ocr_text`; the value that is compared.
  ocr_norm          TEXT,
  -- SHA-256 of `ocr_norm`, so the common "identical screenshot" case is a
  -- single indexed lookup instead of a full string comparison.
  ocr_hash          TEXT,
  token_count       INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK(status IN ('PENDING', 'DONE', 'EMPTY', 'FAILED')),
  error             TEXT,
  scanned_at        TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- Exact-match shortlist for the duplicate check.
CREATE INDEX idx_payment_proof_ocr_hash ON payment_proof_ocr (ocr_hash);

-- Lets the admin tab report how many proofs are still scanning or failed.
CREATE INDEX idx_payment_proof_ocr_status ON payment_proof_ocr (status);