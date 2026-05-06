const BASE = import.meta.env.VITE_API_URL || '/api';

async function req(path, opts = {}) {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  const data = await res.json().catch(() => ({ error: '서버 응답 오류' }));
  if (!res.ok) throw new Error(data.error || '서버 오류');
  return data;
}

const body = (d) => JSON.stringify(d);

export const api = {
  // Auth
  login: (name, pin, login_as) => req('/auth/login', { method: 'POST', body: body({ name, pin, ...(login_as ? { login_as } : {}) }) }),
  getMe: () => req('/auth/me'),

  // Attendance
  getAttendance: (date, service) => req(`/attendance?date=${date}&service=${encodeURIComponent(service)}`),
  markAttendance: (student_id, date) => req('/attendance', { method: 'POST', body: body({ student_id, date }) }),
  unmarkAttendance: (student_id, date) => req('/attendance', { method: 'DELETE', body: body({ student_id, date }) }),

  // Students
  getStudents: () => req('/students'),
  getAllStudents: () => req('/students/all'),
  addStudent: (d) => req('/students', { method: 'POST', body: body(d) }),
  addNewFriendPublic: (d) => req('/students/new-friend', { method: 'POST', body: body(d) }),
  updateStudent: (id, d) => req(`/students/${id}`, { method: 'PUT', body: body(d) }),
  deleteStudent: (id) => req(`/students/${id}`, { method: 'DELETE' }),
  transferStudent: (id, d) => req(`/students/${id}/transfer`, { method: 'POST', body: body(d) }),
  registerNewFriend: (id, d) => req(`/students/${id}/register`, { method: 'POST', body: body(d) }),

  // Scores
  getScores: (week_date, class_name, service) => {
    const p = new URLSearchParams({ week_date });
    if (class_name) p.set('class_name', class_name);
    if (service) p.set('service', service);
    return req(`/scores?${p}`);
  },
  saveScores: (scores) => req('/scores', { method: 'POST', body: body({ scores }) }),
  getScoreHistory: (class_name, service) => {
    const p = new URLSearchParams();
    if (class_name) p.set('class_name', class_name);
    if (service) p.set('service', service);
    return req(`/scores/history?${p}`);
  },

  // Admin
  getAttendanceSummary: (date) => req(`/admin/attendance-summary?date=${date}`),
  getAdminScores: (week_date, sort, start_date, end_date) => {
    const p = new URLSearchParams({ sort: sort || 'class' });
    if (start_date && end_date) { p.set('start_date', start_date); p.set('end_date', end_date); }
    else if (week_date) p.set('week_date', week_date);
    return req(`/admin/scores?${p}`);
  },
  getNewFriends: () => req('/admin/new-friends'),
  getBirthdays: (month, type = 'student', service = '', grade = '') => {
    const p = new URLSearchParams({ month, type });
    if (service) p.set('service', service);
    if (grade) p.set('grade', grade);
    return req(`/admin/birthdays?${p}`);
  },
  resetAllPins: () => req('/admin/reset-pins', { method: 'POST' }),
  getUsers: () => req('/users'),

  // Teachers (admin)
  getTeachers: () => req('/admin/teachers'),
  addTeacher: (d) => req('/admin/teachers', { method: 'POST', body: body(d) }),
  updateTeacher: (id, d) => req(`/admin/teachers/${id}`, { method: 'PUT', body: body(d) }),
  deleteTeacher: (id) => req(`/admin/teachers/${id}`, { method: 'DELETE' }),
  changePin: (id, pin) => req(`/users/${id}/pin`, { method: 'PUT', body: body({ pin }) }),

  // Score Rules
  getScoreRules: () => req('/score-rules'),
  saveScoreRules: (d) => req('/score-rules', { method: 'POST', body: body(d) }),
  updateScoreRules: (id, d) => req(`/score-rules/${id}`, { method: 'PUT', body: body(d) }),

  // Suggestions
  getSuggestions: () => req('/suggestions'),
  submitSuggestion: (content, is_anonymous) => req('/suggestions', { method: 'POST', body: body({ content, is_anonymous }) }),
  deleteSuggestion: (id) => req(`/suggestions/${id}`, { method: 'DELETE' }),
};
