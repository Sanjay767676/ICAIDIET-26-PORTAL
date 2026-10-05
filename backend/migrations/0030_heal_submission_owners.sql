-- ====================================================
-- Migration 0030: Re-link submissions from @clerk.local placeholder
-- accounts to their matching real user account
-- ====================================================

UPDATE submissions
SET user_id = (
    SELECT u.id FROM users u
    WHERE lower(trim(u.email)) = lower(trim(submissions.author_email))
    LIMIT 1
)
WHERE user_id IN (
    SELECT u2.id FROM users u2 WHERE u2.email LIKE '%@clerk.local'
)
AND EXISTS (
    SELECT 1 FROM users u3
    WHERE lower(trim(u3.email)) = lower(trim(submissions.author_email))
);
