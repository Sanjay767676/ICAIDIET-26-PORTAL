-- Migration 0042: superseded by 0043_paper_attendance.sql.
-- An earlier draft of the attendance scanner (per-person passes + staff
-- logins) was replaced by one QR per paper before release. Kept as a no-op so
-- the migration sequence stays continuous.
SELECT 1;
