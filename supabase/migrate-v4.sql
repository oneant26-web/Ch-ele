-- Feature additions: memo, friend_type on students; unit on score_rules
ALTER TABLE students ADD COLUMN IF NOT EXISTS memo TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS friend_type TEXT;
ALTER TABLE score_rules ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT '점';
UPDATE score_rules SET unit = '점' WHERE unit IS NULL;
