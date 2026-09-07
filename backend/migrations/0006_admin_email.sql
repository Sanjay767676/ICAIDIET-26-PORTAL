-- ====================================================
-- Migration 0006: Admin login email -> admin@snsct.org
-- - Login accepts username "admin" (bound to @snsct.org)
--   or the full email address.
-- - Password is unchanged: admin123
--   (SHA-256 of "admin123" = 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9)
-- ====================================================

UPDATE users
SET
  name = 'Administrator',
  email = 'admin@snsct.org',
  updated_at = datetime('now')
WHERE id = 'admin-snsct';