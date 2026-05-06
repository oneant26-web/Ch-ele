const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGIN || true
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'],
  credentials: true,
}));
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'dongshin-dev-secret';

// ─── Middleware ──────────────────────────────────────────────────────────────

function authenticate(req, res, next) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: '토큰이 유효하지 않습니다.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin' && req.user?.position !== '행정팀') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  next();
}

function requireOfficer(req, res, next) {
  const { role, position } = req.user || {};
  if (role === 'admin' || position === '임원' || position === '관리자') return next();
  return res.status(403).json({ error: '임원 권한이 필요합니다.' });
}

function requireTeacher(req, res, next) {
  if (!['admin', 'teacher'].includes(req.user?.role)) return res.status(403).json({ error: '권한이 없습니다.' });
  next();
}

// ─── Auth ────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  const { name, pin, login_as } = req.body;
  if (!name || !pin) return res.status(400).json({ error: '이름과 PIN을 입력해주세요.' });

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('name', name)
    .eq('pin', pin)
    .single();

  if (error || !user) return res.status(401).json({ error: '이름 또는 PIN이 올바르지 않습니다.' });

  // 이중 역할: 임원이 반선생님으로 로그인 선택 시 teacher 역할로 토큰 발급
  let role = user.role;
  if (login_as === 'teacher' && (user.role === 'admin' || user.position === '임원' || user.position === '관리자') && user.class_name) {
    role = 'teacher';
  }

  const payload = { id: user.id, name: user.name, role, class_name: user.class_name, service: user.service, position: user.position || null };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: payload });
});

app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: req.user }));

// ─── Attendance ───────────────────────────────────────────────────────────────

app.get('/api/attendance', async (req, res) => {
  const { date, service } = req.query;
  if (!date) return res.status(400).json({ error: '날짜가 필요합니다.' });

  let q = supabase
    .from('students')
    .select('id, name, gender, service, grade, class_name, teacher_name, type, new_friend_count, visit_date_2, visit_date_3, visit_date_4, visit_date_5, visit_date_6, registered_at, friend_type')
    .eq('is_active', true)
    .order('class_name')
    .order('name');
  if (service) q = q.eq('service', service);

  const { data: students, error: se } = await q;
  if (se) return res.status(500).json({ error: se.message });

  const { data: att, error: ae } = await supabase
    .from('attendance')
    .select('student_id')
    .eq('date', date);
  if (ae) return res.status(500).json({ error: ae.message });

  res.json({ students, attendance: att.map(a => a.student_id) });
});

app.post('/api/attendance', async (req, res) => {
  const { student_id, date } = req.body;
  if (!student_id || !date) return res.status(400).json({ error: '학생 ID와 날짜가 필요합니다.' });

  const { error } = await supabase
    .from('attendance')
    .upsert({ student_id, date, checked_by: '출석체크' }, { onConflict: 'student_id,date' });
  if (error) return res.status(500).json({ error: error.message });

  // Auto-effects based on student type
  const { data: student } = await supabase
    .from('students')
    .select('id, type, registered_at, visit_date_2, visit_date_3, visit_date_4, visit_date_5, visit_date_6')
    .eq('id', student_id)
    .maybeSingle();

  let studentUpdate = null;

  if (student) {
    // Auto-check worship for regular/prayer students
    if (student.type === '일반' || student.type === '기도반') {
      const { data: existing } = await supabase.from('scores').select('id').eq('student_id', student_id).eq('week_date', date).maybeSingle();
      if (existing) {
        await supabase.from('scores').update({ worship: true }).eq('id', existing.id);
      } else {
        await supabase.from('scores').insert({ student_id, week_date: date, worship: true, bible_carry: false, recitation: false, bible_reading: 0, evangelism: false });
      }
    }

    // Auto-fill next visit date slot for new friends
    if (student.type === '새친구') {
      const allSlots = ['registered_at', 'visit_date_2', 'visit_date_3', 'visit_date_4', 'visit_date_5', 'visit_date_6'];
      const filledDates = allSlots.map(k => student[k]).filter(Boolean);
      if (!filledDates.includes(date)) {
        const fillable = ['visit_date_2', 'visit_date_3', 'visit_date_4', 'visit_date_5', 'visit_date_6'];
        const nextEmpty = fillable.find(k => !student[k]);
        if (nextEmpty) {
          const { data: updated } = await supabase.from('students').update({ [nextEmpty]: date }).eq('id', student_id)
            .select('registered_at, visit_date_2, visit_date_3, visit_date_4, visit_date_5, visit_date_6').single();
          studentUpdate = updated;
        }
      }
    }
  }

  res.json({ success: true, ...(studentUpdate ? { student_update: studentUpdate } : {}) });
});

app.delete('/api/attendance', async (req, res) => {
  const { student_id, date } = req.body;
  if (!student_id || !date) return res.status(400).json({ error: '학생 ID와 날짜가 필요합니다.' });

  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('student_id', student_id)
    .eq('date', date);
  if (error) return res.status(500).json({ error: error.message });

  // Auto-clear visit date slot for new friends when unchecking attendance
  const { data: student } = await supabase
    .from('students')
    .select('id, type, visit_date_2, visit_date_3, visit_date_4, visit_date_5, visit_date_6')
    .eq('id', student_id)
    .maybeSingle();

  let studentUpdate = null;
  if (student && student.type === '새친구') {
    const slotKeys = ['visit_date_2', 'visit_date_3', 'visit_date_4', 'visit_date_5', 'visit_date_6'];
    const update = {};
    slotKeys.forEach(k => { if (student[k] === date) update[k] = null; });
    if (Object.keys(update).length > 0) {
      const { data: updated } = await supabase.from('students').update(update).eq('id', student_id)
        .select('registered_at, visit_date_2, visit_date_3, visit_date_4, visit_date_5, visit_date_6').single();
      studentUpdate = updated;
    }
  }

  res.json({ success: true, ...(studentUpdate ? { student_update: studentUpdate } : {}) });
});

// ─── Students ─────────────────────────────────────────────────────────────────

app.get('/api/students', authenticate, requireTeacher, async (req, res) => {
  let q = supabase.from('students').select('*').eq('is_active', true).order('class_name').order('name');
  if (req.user.role === 'teacher') {
    q = q.eq('class_name', req.user.class_name).eq('service', req.user.service);
  }
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ students: data });
});

app.get('/api/students/all', authenticate, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('students').select('*').order('service').order('grade').order('class_name').order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ students: data });
});

// 인증 없이 새친구 즉석 등록 (출석체크 페이지)
app.post('/api/students/new-friend', async (req, res) => {
  const { name, gender, service, friend_type, recruiter_name, recruiter_service, recruiter_grade, recruiter_class } = req.body;
  if (!name || !service) return res.status(400).json({ error: '이름과 예배를 입력해주세요.' });
  const { data, error } = await supabase.from('students').insert({
    name, gender: gender || null, service,
    grade: null, class_name: '새친구반', teacher_name: '',
    type: '새친구', new_friend_count: 0,
    friend_type: friend_type || null,
    registered_at: new Date().toISOString().split('T')[0],
    recruiter_name: recruiter_name || null,
    recruiter_service: recruiter_service || null,
    recruiter_grade: recruiter_grade ? parseInt(recruiter_grade) : null,
    recruiter_class: recruiter_class || null,
    is_active: true,
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ student: data });
});

app.post('/api/students', authenticate, requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('students').insert(req.body).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ student: data });
});

app.put('/api/students/:id', authenticate, requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('students').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ student: data });
});

app.delete('/api/students/:id', authenticate, requireAdmin, async (req, res) => {
  const { error } = await supabase.from('students').update({ is_active: false }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post('/api/students/:id/transfer', authenticate, requireAdmin, async (req, res) => {
  const { class_name, teacher_name, grade, service } = req.body;
  const update = { class_name, teacher_name };
  if (grade) update.grade = grade;
  if (service) update.service = service;
  const { data, error } = await supabase.from('students').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ student: data });
});

app.post('/api/students/:id/register', authenticate, requireAdmin, async (req, res) => {
  const { class_name, teacher_name, grade, service } = req.body;
  const { data, error } = await supabase
    .from('students')
    .update({ type: '일반', class_name, teacher_name, grade, service, registered_at: new Date().toISOString().split('T')[0] })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ student: data });
});

// ─── Scores ───────────────────────────────────────────────────────────────────

// 반 전체 기간 점수 히스토리 (선생님용)
app.get('/api/scores/history', authenticate, requireTeacher, async (req, res) => {
  const targetClass = req.user.role === 'admin' ? req.query.class_name : req.user.class_name;
  const targetService = req.user.role === 'admin' ? req.query.service : req.user.service;

  let q = supabase.from('students').select('id, name, class_name, service, grade, type').eq('is_active', true).eq('type', '일반').order('name');
  if (targetClass) q = q.eq('class_name', targetClass);
  if (targetService) q = q.eq('service', targetService);

  const { data: students, error: se } = await q;
  if (se) return res.status(500).json({ error: se.message });

  const ids = students.map(s => s.id);
  let allScores = [];
  if (ids.length > 0) {
    const { data: scores, error: sce } = await supabase.from('scores').select('*').in('student_id', ids).order('week_date', { ascending: false });
    if (sce) return res.status(500).json({ error: sce.message });
    allScores = scores || [];
  }

  const { data: rules } = await supabase.from('score_rules').select('*').order('applied_from', { ascending: true });
  res.json({ students, scores: allScores, rules: rules || [] });
});

app.get('/api/scores', authenticate, requireTeacher, async (req, res) => {
  const { week_date, class_name: qClass, service: qService } = req.query;
  if (!week_date) return res.status(400).json({ error: '날짜가 필요합니다.' });

  const targetClass = req.user.role === 'admin' ? qClass : req.user.class_name;
  const targetService = req.user.role === 'admin' ? qService : req.user.service;

  let q = supabase.from('students').select('id, name, class_name, teacher_name, service, grade, type').eq('is_active', true).eq('type', '일반').order('name');
  if (targetClass) q = q.eq('class_name', targetClass);
  if (targetService) q = q.eq('service', targetService);

  const { data: students, error: se } = await q;
  if (se) return res.status(500).json({ error: se.message });

  const ids = students.map(s => s.id);
  const { data: scores, error: sce } = await supabase.from('scores').select('*').in('student_id', ids).eq('week_date', week_date);
  if (sce) return res.status(500).json({ error: sce.message });

  const { data: rules } = await supabase
    .from('score_rules')
    .select('*')
    .lte('applied_from', week_date)
    .order('applied_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  res.json({
    students,
    scores: scores || [],
    rules: rules || { worship_pts: 10, bible_carry_pts: 5, recitation_pts: 10, bible_reading_pts: 2, evangelism_pts: 20 },
  });
});

app.post('/api/scores', authenticate, requireTeacher, async (req, res) => {
  const { scores } = req.body;
  if (!Array.isArray(scores)) return res.status(400).json({ error: '점수 데이터가 필요합니다.' });

  const rows = scores.map(({ id, ...s }) => ({ ...s, created_by: req.user.name, bible_reading: parseInt(s.bible_reading) || 0 }));
  const { error } = await supabase.from('scores').upsert(rows, { onConflict: 'student_id,week_date' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Admin ────────────────────────────────────────────────────────────────────

app.get('/api/admin/attendance-summary', authenticate, requireAdmin, async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: '날짜가 필요합니다.' });

  const { data: students, error: se } = await supabase.from('students').select('id, service, grade, type').eq('is_active', true);
  if (se) return res.status(500).json({ error: se.message });

  const { data: att, error: ae } = await supabase.from('attendance').select('student_id').eq('date', date);
  if (ae) return res.status(500).json({ error: ae.message });

  const checked = new Set(att.map(a => a.student_id));

  const summary = {};
  ['1부', '2부'].forEach(svc => {
    summary[svc] = {};
    [3, 4].forEach(g => {
      const list = students.filter(s => s.service === svc && s.grade === g && s.type === '일반');
      summary[svc][`${g}학년`] = { total: list.length, attended: list.filter(s => checked.has(s.id)).length };
    });
    const nf = students.filter(s => s.service === svc && s.type === '새친구');
    summary[svc]['새친구'] = { total: nf.length, attended: nf.filter(s => checked.has(s.id)).length };
    const pr = students.filter(s => s.service === svc && s.type === '기도반');
    summary[svc]['기도반'] = { total: pr.length, attended: pr.filter(s => checked.has(s.id)).length };
  });

  res.json({ summary, date });
});

app.get('/api/admin/scores', authenticate, requireAdmin, async (req, res) => {
  const { week_date, start_date, end_date, sort = 'class' } = req.query;
  const isRange = start_date && end_date;
  if (!isRange && !week_date) return res.status(400).json({ error: '날짜가 필요합니다.' });

  const refDate = isRange ? end_date : week_date;

  const { data: students, error: se } = await supabase
    .from('students')
    .select('id, name, gender, service, grade, class_name, teacher_name')
    .eq('is_active', true)
    .eq('type', '일반')
    .order('service').order('grade').order('class_name').order('name');
  if (se) return res.status(500).json({ error: se.message });

  const ids = students.map(s => s.id);

  const { data: rules } = await supabase
    .from('score_rules').select('*')
    .lte('applied_from', refDate)
    .order('applied_from', { ascending: false })
    .limit(1).maybeSingle();
  const pts = rules || { worship_pts: 10, bible_carry_pts: 5, recitation_pts: 10, bible_reading_pts: 2, evangelism_pts: 20 };

  if (isRange) {
    const { data: scores, error: sco } = await supabase.from('scores').select('*')
      .in('student_id', ids).gte('week_date', start_date).lte('week_date', end_date);
    if (sco) return res.status(500).json({ error: sco.message });

    const agg = {};
    (scores || []).forEach(s => {
      if (!agg[s.student_id]) agg[s.student_id] = { worship: 0, bible_carry: 0, recitation: 0, bible_reading: 0, evangelism: 0, weeks: 0 };
      agg[s.student_id].worship     += s.worship     ? 1 : 0;
      agg[s.student_id].bible_carry += s.bible_carry ? 1 : 0;
      agg[s.student_id].recitation  += s.recitation  ? 1 : 0;
      agg[s.student_id].bible_reading += s.bible_reading || 0;
      agg[s.student_id].evangelism  += s.evangelism  ? 1 : 0;
      agg[s.student_id].weeks++;
    });

    const rows = students.map(st => {
      const a = agg[st.id] || {};
      const total = (a.worship || 0) * pts.worship_pts
        + (a.bible_carry || 0) * pts.bible_carry_pts
        + (a.recitation || 0) * pts.recitation_pts
        + (a.bible_reading || 0) * pts.bible_reading_pts
        + (a.evangelism || 0) * pts.evangelism_pts;
      return { ...st, agg: a.weeks ? a : null, total };
    });
    if (sort === 'score') rows.sort((a, b) => b.total - a.total);
    return res.json({ students: rows, rules: pts, mode: 'range' });
  }

  const { data: scores, error: sco } = await supabase.from('scores').select('*').in('student_id', ids).eq('week_date', week_date);
  if (sco) return res.status(500).json({ error: sco.message });

  const scMap = {};
  (scores || []).forEach(s => { scMap[s.student_id] = s; });

  const rows = students.map(st => {
    const sc = scMap[st.id] || {};
    const total = (sc.worship ? pts.worship_pts : 0)
      + (sc.bible_carry ? pts.bible_carry_pts : 0)
      + (sc.recitation ? pts.recitation_pts : 0)
      + ((sc.bible_reading || 0) * pts.bible_reading_pts)
      + (sc.evangelism ? pts.evangelism_pts : 0);
    return { ...st, score: sc.student_id ? sc : null, total };
  });

  if (sort === 'score') rows.sort((a, b) => b.total - a.total);
  res.json({ students: rows, rules: pts, mode: 'single' });
});

app.get('/api/admin/new-friends', authenticate, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('type', '새친구')
    .eq('is_active', true)
    .order('service')
    .order('registered_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const ids = data.map(s => s.id);
  let visitCounts = {};
  if (ids.length > 0) {
    const { data: attData } = await supabase.from('attendance').select('student_id').in('student_id', ids);
    (attData || []).forEach(a => {
      visitCounts[a.student_id] = (visitCounts[a.student_id] || 0) + 1;
    });
  }

  res.json({ students: data.map(s => ({ ...s, visit_count: visitCounts[s.id] || 0 })) });
});

app.get('/api/admin/birthdays', authenticate, requireTeacher, async (req, res) => {
  const { month, type = 'student' } = req.query;

  if (type === 'teacher') {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, birthday, phone, role, position, class_name, service')
      .not('birthday', 'is', null)
      .order('name');
    if (error) return res.status(500).json({ error: error.message });
    const monthNum = month ? parseInt(month) : null;
    const result = monthNum
      ? data.filter(u => { const m = u.birthday && u.birthday.match(/(\d+)월/); return m && parseInt(m[1]) === monthNum; })
      : data;
    return res.json({ teachers: result });
  }

  let q = supabase.from('students').select('id, name, gender, birthday, service, grade, class_name, teacher_name, phone').eq('is_active', true).not('birthday', 'is', null).order('birthday');
  if (req.user.role === 'teacher' && req.user.position !== '행정팀') {
    q = q.eq('class_name', req.user.class_name).eq('service', req.user.service);
  } else {
    const { service: svcFilter, grade: gradeFilter } = req.query;
    if (svcFilter) q = q.eq('service', svcFilter);
    if (gradeFilter) q = q.eq('grade', parseInt(gradeFilter));
  }
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  const result = month
    ? data.filter(s => s.birthday && new Date(s.birthday).getMonth() + 1 === parseInt(month))
    : data;
  res.json({ students: result });
});

// ─── Admin: Teachers ──────────────────────────────────────────────────────────

// 선생님 전체 목록 (연락처/생일 포함) — 임원 전용
app.get('/api/admin/teachers', authenticate, requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, role, position, class_name, service, phone, birthday')
    .order('position')
    .order('service')
    .order('class_name');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ teachers: data });
});

// 선생님 추가 — 임원 전용
app.post('/api/admin/teachers', authenticate, requireAdmin, async (req, res) => {
  const { name, pin, position, service, class_name, phone, birthday } = req.body;
  if (!name || !pin) return res.status(400).json({ error: '이름과 PIN을 입력해주세요.' });
  const role = (position === '관리자' || position === '임원') ? 'admin' : 'teacher';
  const { data, error } = await supabase.from('users').insert({
    name, pin, role,
    position: position || '교사',
    service: service || null,
    class_name: class_name || null,
    phone: phone || null,
    birthday: birthday || null,
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ teacher: data });
});

// 선생님 삭제 — 임원 전용
app.delete('/api/admin/teachers/:id', authenticate, requireAdmin, async (req, res) => {
  const { error } = await supabase.from('users').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// 선생님 정보 수정 (연락처/생일/반/포지션) — 임원 전용
app.put('/api/admin/teachers/:id', authenticate, requireAdmin, async (req, res) => {
  const allowed = ['phone', 'birthday', 'class_name', 'service', 'name', 'position'];
  const update = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k] || null; });
  const { data, error } = await supabase.from('users').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ teacher: data });
});

// ─── Users ────────────────────────────────────────────────────────────────────

app.get('/api/users', async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, role, class_name, service, position')
    .order('role').order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ users: data });
});

// PIN 변경 — 임원은 누구든, 선생님은 본인만
app.put('/api/users/:id/pin', authenticate, async (req, res) => {
  const { pin } = req.body;
  if (!pin || pin.length < 4) return res.status(400).json({ error: 'PIN은 4자리 이상이어야 합니다.' });
  if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
    return res.status(403).json({ error: '권한이 없습니다.' });
  }
  const { error } = await supabase.from('users').update({ pin }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Score Rules ──────────────────────────────────────────────────────────────

app.get('/api/score-rules', async (req, res) => {
  const { data, error } = await supabase
    .from('score_rules').select('*')
    .order('applied_from', { ascending: false })
    .limit(1).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ rules: data || { worship_pts: 10, bible_carry_pts: 5, recitation_pts: 10, bible_reading_pts: 2, evangelism_pts: 20, applied_from: new Date().toISOString().split('T')[0] } });
});

app.post('/api/score-rules', authenticate, requireAdmin, async (req, res) => {
  const { worship_pts, bible_carry_pts, recitation_pts, bible_reading_pts, evangelism_pts, applied_from, unit, event_name, end_date } = req.body;
  const { data, error } = await supabase.from('score_rules').insert({ worship_pts, bible_carry_pts, recitation_pts, bible_reading_pts, evangelism_pts, applied_from, unit: unit || '점', event_name: event_name || null, end_date: end_date || null }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ rules: data });
});

app.put('/api/score-rules/:id', authenticate, requireAdmin, async (req, res) => {
  const { worship_pts, bible_carry_pts, recitation_pts, bible_reading_pts, evangelism_pts, applied_from, unit, event_name, end_date } = req.body;
  const { data, error } = await supabase.from('score_rules')
    .update({ worship_pts, bible_carry_pts, recitation_pts, bible_reading_pts, evangelism_pts, applied_from, unit: unit || '점', event_name: event_name || null, end_date: end_date || null })
    .eq('id', req.params.id)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ rules: data });
});

// ─── Suggestions ─────────────────────────────────────────────────────────────

app.post('/api/suggestions', authenticate, requireTeacher, async (req, res) => {
  const { content, is_anonymous } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: '내용을 입력해주세요.' });
  const author_name = is_anonymous ? null : req.user.name;
  const { data, error } = await supabase.from('suggestions')
    .insert({ content: content.trim(), is_anonymous: !!is_anonymous, author_name })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ suggestion: data });
});

app.get('/api/suggestions', authenticate, requireOfficer, async (req, res) => {
  const { data, error } = await supabase.from('suggestions')
    .select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ suggestions: data });
});

app.delete('/api/suggestions/:id', authenticate, requireOfficer, async (req, res) => {
  const { error } = await supabase.from('suggestions').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Admin: Reset All PINs ────────────────────────────────────────────────────
app.post('/api/admin/reset-pins', authenticate, requireAdmin, async (req, res) => {
  const { error } = await supabase
    .from('users')
    .update({ pin: '0000' })
    .in('role', ['admin', 'teacher', 'checker']);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = app;
