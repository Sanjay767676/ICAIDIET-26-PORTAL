-- ====================================================
-- Migration 0002: Admin user + submission fields
-- - Creates the admin user (username: snsct, password: admin123)
-- - Adds track and author columns to submissions
-- ====================================================

-- Add track + author columns to submissions (keep keywords for real keywords)
ALTER TABLE submissions ADD COLUMN track TEXT DEFAULT '';
ALTER TABLE submissions ADD COLUMN author_name TEXT DEFAULT '';
ALTER TABLE submissions ADD COLUMN author_email TEXT DEFAULT '';

-- Seed admin user: username = snsct (email snsct@snsct.edu), password = admin123 (SHA-256 hashed)
INSERT OR IGNORE INTO users (id, name, email, password_hash, role, created_at, updated_at)
VALUES (
  'admin-snsct',
  'SNSCT Admin',
  'snsct@snsct.edu',
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  'ADMIN',
  datetime('now'),
  datetime('now')
);
