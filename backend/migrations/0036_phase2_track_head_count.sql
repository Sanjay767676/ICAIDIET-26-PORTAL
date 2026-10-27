-- Phase 2 now records the conference track the author will attend for and, for
-- offline attendees, how many people are attending (head count, 1-6).
ALTER TABLE submissions ADD COLUMN phase2_track TEXT;
ALTER TABLE submissions ADD COLUMN phase2_head_count INTEGER;
