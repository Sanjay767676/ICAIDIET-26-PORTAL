-- ====================================================
-- Migration 0005: Update admin credentials + user_profiles for Clerk
-- - Changes admin username from snsct to snsadmin
-- - Ensures user_profiles supports Clerk-based users (clerk_id column)
-- ====================================================

-- Update admin user credentials: snsadmin / admin123
-- SHA-256 of "admin123" = 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
UPDATE users
SET
  name = 'SNSCT Admin',
  email = 'snsadmin@snsct.edu',
  password_hash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  updated_at = datetime('now')
WHERE id = 'admin-snsct';

-- Add clerk_id column to user_profiles for Clerk integration
ALTER TABLE user_profiles ADD COLUMN clerk_id TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_user_profiles_clerk_id ON user_profiles(clerk_id);
