-- 건의(문의)사항 게시판
CREATE TABLE IF NOT EXISTS suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  author_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
