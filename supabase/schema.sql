-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Users ────────────────────────────────────────────────────────────────────
create table if not exists users (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  role        text not null check (role in ('admin', 'teacher', 'checker')),
  class_name  text,
  service     text check (service in ('1부', '2부')),
  pin         text not null,
  created_at  timestamptz default now()
);

-- ─── Students ─────────────────────────────────────────────────────────────────
create table if not exists students (
  id               uuid default gen_random_uuid() primary key,
  name             text not null,
  gender           text check (gender in ('남', '여')),
  birthday         date,
  phone            text,
  service          text not null check (service in ('1부', '2부')),
  grade            integer check (grade in (3, 4)),
  class_name       text not null,
  teacher_name     text not null,
  type             text not null default '일반' check (type in ('일반', '새친구')),
  new_friend_count integer default 0,
  registered_at    date default current_date,
  is_active        boolean default true,
  created_at       timestamptz default now()
);

create index if not exists idx_students_service_class on students (service, class_name);
create index if not exists idx_students_type on students (type);
create index if not exists idx_students_active on students (is_active);

-- ─── Attendance ───────────────────────────────────────────────────────────────
create table if not exists attendance (
  id          uuid default gen_random_uuid() primary key,
  student_id  uuid not null references students(id) on delete cascade,
  date        date not null,
  checked_by  text,
  created_at  timestamptz default now(),
  unique (student_id, date)
);

create index if not exists idx_attendance_date on attendance (date);

-- ─── Scores ───────────────────────────────────────────────────────────────────
create table if not exists scores (
  id              uuid default gen_random_uuid() primary key,
  student_id      uuid not null references students(id) on delete cascade,
  week_date       date not null,
  worship         boolean default false,
  bible_carry     boolean default false,
  recitation      boolean default false,
  bible_reading   integer default 0,
  evangelism      boolean default false,
  absence_reason  text,
  created_by      text,
  created_at      timestamptz default now(),
  unique (student_id, week_date)
);

create index if not exists idx_scores_week on scores (week_date);

-- ─── Score Rules ──────────────────────────────────────────────────────────────
create table if not exists score_rules (
  id                uuid default gen_random_uuid() primary key,
  worship_pts       integer not null default 10,
  bible_carry_pts   integer not null default 5,
  recitation_pts    integer not null default 10,
  bible_reading_pts integer not null default 2,
  evangelism_pts    integer not null default 20,
  applied_from      date not null default current_date,
  created_at        timestamptz default now()
);

-- ─── RLS (Row Level Security) ─────────────────────────────────────────────────
-- 서비스 키(Service Role Key)를 사용하는 백엔드 API가 모든 접근을 담당하므로
-- 프론트엔드에서 직접 접근을 막기 위해 RLS를 활성화합니다.
alter table users      enable row level security;
alter table students   enable row level security;
alter table attendance enable row level security;
alter table scores     enable row level security;
alter table score_rules enable row level security;

-- Service role은 RLS를 우회하므로 백엔드에서 정상 작동합니다.
-- anon/authenticated key로 직접 접근하는 경우를 모두 차단:
drop policy if exists "deny_all_users"      on users;
drop policy if exists "deny_all_students"   on students;
drop policy if exists "deny_all_attendance" on attendance;
drop policy if exists "deny_all_scores"     on scores;
drop policy if exists "deny_all_rules"      on score_rules;

create policy "deny_all_users"      on users      for all using (false);
create policy "deny_all_students"   on students   for all using (false);
create policy "deny_all_attendance" on attendance for all using (false);
create policy "deny_all_scores"     on scores     for all using (false);
create policy "deny_all_rules"      on score_rules for all using (false);
