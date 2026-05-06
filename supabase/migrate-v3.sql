-- migrate-v3: add position column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS position TEXT;

-- Set defaults: existing admins → 임원, existing teachers → 교사
UPDATE users SET position = '임원' WHERE role = 'admin' AND position IS NULL;
UPDATE users SET position = '교사' WHERE role IN ('teacher', 'checker') AND position IS NULL;
