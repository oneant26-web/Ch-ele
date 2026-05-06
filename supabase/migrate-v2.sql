-- V2 Migration: 선생님 연락처/생일, 새친구 전도자 및 방문날짜, 기도반 타입 추가
-- Supabase Dashboard > SQL Editor 에서 실행하세요.

-- 1. users: 전화번호/생일 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday TEXT;

-- 2. students: 새친구 전도자 정보 + 방문날짜 컬럼 추가
ALTER TABLE students ADD COLUMN IF NOT EXISTS recruiter_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS recruiter_service TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS recruiter_grade INT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS recruiter_class TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS visit_date_2 DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS visit_date_3 DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS visit_date_4 DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS visit_date_5 DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS visit_date_6 DATE;

-- 3. students.type 에 '기도반' 추가
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_type_check;
ALTER TABLE students ADD CONSTRAINT students_type_check
  CHECK (type IN ('일반', '새친구', '기도반'));
