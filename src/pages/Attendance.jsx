import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';

function today() {
  return new Date().toLocaleDateString('en-CA');
}

function classNameToSortKey(name) {
  const nums = (name.match(/\d+/g) || []).map(Number);
  if (nums.length === 0) return 0;
  if (nums.length === 1) return nums[0];
  return nums[0] * 1000 + nums[nums.length - 1];
}

function groupByClass(students) {
  const map = {};
  students.forEach(s => {
    const key = s.class_name;
    if (!map[key]) map[key] = { class_name: key, teacher_name: s.teacher_name, students: [] };
    map[key].students.push(s);
  });
  return Object.values(map).sort((a, b) => classNameToSortKey(a.class_name) - classNameToSortKey(b.class_name));
}

// ─── 새친구 추가 모달 ─────────────────────────────────────────────────────────
function AddNewFriendModal({ service, onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', gender: '', service, friend_type: '초신자' });
  const [showRecruiter, setShowRecruiter] = useState(false);
  const [recruiter, setRecruiter] = useState({ name: '', service: '1부', grade: '3', class: '' });
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { showToast('이름을 입력해주세요.', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        ...(showRecruiter && recruiter.name ? {
          recruiter_name: recruiter.name,
          recruiter_service: recruiter.service,
          recruiter_grade: parseInt(recruiter.grade) || null,
          recruiter_class: recruiter.class,
        } : {}),
      };
      const { student } = await api.addNewFriendPublic(payload);
      showToast(`${student.name} 새친구가 추가됐습니다!`, 'success');
      onAdded(student);
      onClose();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-sm shadow-xl">
        <h3 className="text-xl font-bold text-gray-800 mb-5">새친구 추가</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-600 font-semibold mb-2">이름 *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="새친구 이름" className="input-field text-lg" autoFocus />
          </div>
          <div>
            <label className="block text-gray-600 font-semibold mb-2">성별</label>
            <div className="flex gap-3">
              {['남', '여', ''].map((g, i) => (
                <button key={i} type="button" onClick={() => setForm(f => ({ ...f, gender: g }))}
                  className={`flex-1 min-h-[52px] rounded-xl font-semibold text-lg border-2 transition-colors ${
                    form.gender === g ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white border-sky-200 text-gray-600 hover:border-sky-400'
                  }`}>
                  {g === '' ? '모름' : g === '남' ? '남 ♂' : '여 ♀'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-gray-600 font-semibold mb-2">구분</label>
            <div className="flex gap-3">
              {['초신자', '기신자'].map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, friend_type: t }))}
                  className={`flex-1 min-h-[52px] rounded-xl font-semibold text-lg border-2 transition-colors ${
                    form.friend_type === t ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white border-sky-200 text-gray-600 hover:border-sky-400'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-gray-600 font-semibold mb-2">예배</label>
            <div className="flex gap-3">
              {['1부', '2부'].map(s => (
                <button key={s} type="button" onClick={() => setForm(f => ({ ...f, service: s }))}
                  className={`flex-1 min-h-[52px] rounded-xl font-semibold text-lg border-2 transition-colors ${
                    form.service === s ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white border-sky-200 text-gray-600 hover:border-sky-400'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          {/* 전도자 정보 (선택) */}
          <div>
            <button type="button" onClick={() => setShowRecruiter(v => !v)}
              className="text-indigo-600 font-semibold text-base underline">
              {showRecruiter ? '▲ 전도자 정보 닫기' : '▼ 전도자 정보 입력 (선택)'}
            </button>
            {showRecruiter && (
              <div className="mt-3 p-3 bg-indigo-50 rounded-xl space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">예배</label>
                    <select value={recruiter.service} onChange={e => setRecruiter(r => ({ ...r, service: e.target.value }))} className="input-field text-sm py-1.5">
                      <option value="1부">1부</option><option value="2부">2부</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">학년</label>
                    <select value={recruiter.grade} onChange={e => setRecruiter(r => ({ ...r, grade: e.target.value }))} className="input-field text-sm py-1.5">
                      <option value="3">3학년</option><option value="4">4학년</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">반</label>
                    <input type="text" value={recruiter.class} onChange={e => setRecruiter(r => ({ ...r, class: e.target.value }))} placeholder="3-1반" className="input-field text-sm py-1.5" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">전도자 이름</label>
                  <input type="text" value={recruiter.name} onChange={e => setRecruiter(r => ({ ...r, name: e.target.value }))} placeholder="친구 이름" className="input-field" />
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">취소</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 text-lg">{saving ? '추가 중...' : '추가'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 출석체크 메인 ────────────────────────────────────────────────────────────
export default function Attendance() {
  const [params, setParams] = useSearchParams();
  const service = params.get('service') || '1부';
  const [date, setDate] = useState(today());

  const [students, setStudents] = useState([]);
  const [attended, setAttended] = useState(new Set());
  const [pending, setPending] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { students, attendance } = await api.getAttendance(date, service);
      setStudents(students);
      setAttended(new Set(attendance));
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [service, date]);

  useEffect(() => { load(); }, [load]);

  async function toggle(studentId) {
    if (pending.has(studentId)) return;
    const isChecked = attended.has(studentId);
    setPending(p => new Set([...p, studentId]));
    setAttended(prev => {
      const next = new Set(prev);
      isChecked ? next.delete(studentId) : next.add(studentId);
      return next;
    });
    try {
      let result;
      if (isChecked) result = await api.unmarkAttendance(studentId, date);
      else result = await api.markAttendance(studentId, date);
      if (result?.student_update) {
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, ...result.student_update } : s));
      }
    } catch (e) {
      setAttended(prev => {
        const next = new Set(prev);
        isChecked ? next.add(studentId) : next.delete(studentId);
        return next;
      });
      showToast(e.message, 'error');
    } finally {
      setPending(p => { const n = new Set(p); n.delete(studentId); return n; });
    }
  }

  function handleNewFriendAdded(student) {
    if (student.service === service) {
      setStudents(prev => [...prev, student]);
    }
  }

  const regularStudents = students.filter(s => s.type === '일반');
  const newFriends = students.filter(s => s.type === '새친구');
  const prayerStudents = students.filter(s => s.type === '기도반');
  const groups = groupByClass(regularStudents);
  const prayerGroups = groupByClass(prayerStudents);
  const totalAttended = [...attended].filter(id => students.find(s => s.id === id)).length;

  function StudentBtn({ s, accentChecked, accentBorder, accentPending }) {
    const isChecked = attended.has(s.id);
    const isPending = pending.has(s.id);
    return (
      <button
        onClick={() => toggle(s.id)}
        disabled={isPending}
        className={`min-h-[52px] rounded-xl font-semibold text-[17px] transition-all duration-150 flex items-center justify-center gap-1 border-2 ${
          isChecked ? `${accentChecked} shadow-md` : `bg-white ${accentBorder} text-gray-700 hover:border-opacity-80`
        } ${isPending ? 'opacity-60' : ''}`}
      >
        {isChecked && <span>✅</span>}
        <span>{s.name}</span>
        {s.gender && (
          <span className={`text-sm ${isChecked ? 'text-white/70' : 'text-gray-400'}`}>
            {s.gender === '남' ? '♂' : '♀'}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-sky-50">
      <header className="bg-sky-500 text-white px-4 pt-6 pb-4 shadow-md">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold">출석 체크</h1>
            <Link to="/login" className="text-sky-100 text-base underline">선생님 로그인</Link>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-sky-400/60 text-white rounded-xl px-3 py-1.5 text-base border-0 focus:outline-none focus:bg-sky-400/80 [color-scheme:dark]"
            />
            <span className="text-sky-100 text-base">출석 {totalAttended}명</span>
          </div>
          <div className="flex gap-2">
            {['1부', '2부'].map(s => (
              <button key={s} onClick={() => setParams({ service: s })}
                className={`flex-1 min-h-[44px] rounded-xl font-bold text-lg transition-colors ${
                  service === s ? 'bg-white text-sky-600' : 'bg-sky-400 text-white hover:bg-sky-300'
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-4">
        {loading ? (
          <Spinner size="lg" />
        ) : (
          <>
            {/* 일반 학생 반별 */}
            {groups.map(group => (
              <section key={group.class_name} className="mb-5">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-sky-700 font-bold text-lg">{group.class_name}</span>
                  <span className="text-gray-500 text-base">{group.teacher_name} 선생님</span>
                  <span className="ml-auto text-sky-600 font-semibold text-base">
                    {group.students.filter(s => attended.has(s.id)).length}/{group.students.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {group.students.map(s => (
                    <StudentBtn key={s.id} s={s}
                      accentChecked="bg-sky-500 border-sky-500 text-white"
                      accentBorder="border-sky-200"
                    />
                  ))}
                </div>
              </section>
            ))}

            {/* 새친구 섹션 */}
            <section className="mb-5">
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-orange-500 font-bold text-lg">새친구</span>
                {newFriends.length > 0 && (
                  <span className="text-orange-400 font-semibold text-base">
                    {newFriends.filter(s => attended.has(s.id)).length}/{newFriends.length}
                  </span>
                )}
                <button onClick={() => setShowAddModal(true)}
                  className="ml-auto min-h-[36px] px-4 py-1 bg-orange-400 text-white font-bold rounded-xl text-base hover:bg-orange-500 active:bg-orange-600 transition-colors flex items-center gap-1">
                  <span className="text-lg leading-none">+</span> 새친구 추가
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {newFriends.map(s => {
                  const isChecked = attended.has(s.id);
                  const isPending = pending.has(s.id);
                  const visitCount = [s.registered_at, s.visit_date_2, s.visit_date_3, s.visit_date_4, s.visit_date_5, s.visit_date_6].filter(Boolean).length;
                  return (
                    <button key={s.id} onClick={() => toggle(s.id)} disabled={isPending}
                      className={`min-h-[52px] rounded-xl font-semibold text-[17px] transition-all duration-150 flex flex-col items-center justify-center border-2 ${
                        isChecked ? 'bg-orange-400 border-orange-400 text-white shadow-md' : 'bg-white border-orange-200 text-gray-700 hover:border-orange-400'
                      } ${isPending ? 'opacity-60' : ''}`}>
                      <span>{isChecked ? '✅ ' : ''}{s.name}</span>
                      <span className={`text-xs mt-0.5 ${isChecked ? 'text-orange-100' : 'text-orange-400'}`}>
                        {s.gender ? `${s.gender} · ` : ''}{visitCount}회 방문
                      </span>
                      {s.friend_type && (
                        <span className={`text-xs ${isChecked ? 'text-orange-100' : s.friend_type === '기신자' ? 'text-purple-400' : 'text-teal-500'}`}>
                          {s.friend_type}
                        </span>
                      )}
                      {s.recruiter_name && (
                        <span className={`text-xs ${isChecked ? 'text-orange-100' : 'text-indigo-400'}`}>
                          전도: {s.recruiter_name}
                        </span>
                      )}
                    </button>
                  );
                })}
                {newFriends.length === 0 && (
                  <div className="col-span-2 sm:col-span-3 text-center py-4 text-gray-400 text-base">
                    오늘 새친구가 없으면 위 버튼으로 추가하세요
                  </div>
                )}
              </div>
            </section>

            {/* 기도반 섹션 */}
            {prayerStudents.length > 0 && (
              <section className="mb-5">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-purple-600 font-bold text-lg">기도반</span>
                  <span className="text-purple-400 font-semibold text-base">
                    {prayerStudents.filter(s => attended.has(s.id)).length}/{prayerStudents.length}
                  </span>
                  <span className="ml-auto text-purple-400 text-sm">출석 시 체크</span>
                </div>
                {prayerGroups.map(group => (
                  <div key={group.class_name} className="mb-3">
                    <p className="text-xs text-purple-500 font-semibold px-1 mb-1">{group.class_name} · {group.teacher_name}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {group.students.map(s => {
                        const isChecked = attended.has(s.id);
                        const isPending = pending.has(s.id);
                        return (
                          <button key={s.id} onClick={() => toggle(s.id)} disabled={isPending}
                            className={`min-h-[52px] rounded-xl font-semibold text-[17px] transition-all duration-150 flex items-center justify-center gap-1 border-2 ${
                              isChecked ? 'bg-purple-500 border-purple-500 text-white shadow-md' : 'bg-white border-purple-200 text-gray-700 hover:border-purple-400'
                            } ${isPending ? 'opacity-60' : ''}`}>
                            {isChecked && <span>✅</span>}
                            <span>{s.name}</span>
                            {s.gender && (
                              <span className={`text-sm ${isChecked ? 'text-purple-100' : 'text-gray-400'}`}>
                                {s.gender === '남' ? '♂' : '♀'}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {students.length === 0 && (
              <div className="text-center py-16 text-gray-400 text-lg">
                <p className="text-4xl mb-3">📋</p>
                <p>등록된 학생이 없습니다.</p>
              </div>
            )}
          </>
        )}
      </main>

      {showAddModal && (
        <AddNewFriendModal
          service={service}
          onClose={() => setShowAddModal(false)}
          onAdded={handleNewFriendAdded}
        />
      )}
    </div>
  );
}
