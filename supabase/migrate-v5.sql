-- v5: score_rules에 event_name, end_date 추가
ALTER TABLE score_rules ADD COLUMN IF NOT EXISTS event_name TEXT;
ALTER TABLE score_rules ADD COLUMN IF NOT EXISTS end_date DATE;
