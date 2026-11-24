-- Migration 0047: remember which author (by email) a certificate belongs to.
--
-- Edit Authors / admin author edits replace the authors rows with new IDs. With the
-- email stored here, a re-saved author keeps the same certificate ID (the PDF is
-- re-rendered with the new details) instead of getting a second certificate.
ALTER TABLE certificates ADD COLUMN author_email TEXT;
