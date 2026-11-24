-- Migration 0046: participant e-certificates.
--
-- One row per author. Rows are created by the certificate engine (Render) through
-- POST /api/internal/certificates/claim, which allocates the certificate ID and
-- marks the row PENDING. The engine then uploads the PDF and the row becomes READY.
--
-- Who is eligible (checked when a row is claimed):
--   submissions.deleted_at IS NULL
--   AND submissions.payment_status = 'APPROVED'          (payment approved by admin)
--   AND submissions.authors_finalised_at IS NOT NULL     (author list edited + approved)
--
-- cert_id = "2026" + random digits (CERT_ID_DIGITS in wrangler.toml, 4 -> e.g. 20264821), unique.
-- printed_name / printed_college are exactly what is on the certificate
-- (title + first + last name, college as entered); the public verifier shows these.
-- r2_key points into the R2 bucket "certificates": <paper title> [<paper id>]/<id> - <name>.pdf

CREATE TABLE IF NOT EXISTS certificates (
  cert_id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL UNIQUE,
  submission_id TEXT NOT NULL,
  paper_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',   -- PENDING | READY
  printed_name TEXT,
  printed_college TEXT,
  r2_key TEXT,
  warnings TEXT,
  claimed_at TEXT NOT NULL,
  generated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_certificates_submission ON certificates(submission_id);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
