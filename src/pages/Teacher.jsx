import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Spinner from '../components/Spinner';
import { api } from '../lib/api';

function getSunday() {
  const d = new Date();
  const sun = new Date(d);
  sun.setDate(d.getDate() - d.getDay());
  return sun.toISOString().split('T')[0];
}

function calcTotal(sc, pts) {
  if (!sc || !pts) return 0;
  return (sc.worship ? pts.worship_pts : 0)
    + (sc.bible_carry ? pts.bible_carry_pts : 0)
    + (sc.recitation ? pts.recitation_pts : 0)
    + ((parseInt(sc.bible_reading) || 0) * pts.bible_reading_pts)
    + (sc.evangelism ? pts.evangelism_pts : 0);
}

const DEFAULT_RULES = { worship_pts: 10, bible_carry_pts: 5, recitation_pts: 10, bible_reading_pts: 2, evangelism_pts: 20, unit: '점' };

function getRulesForDate(allRules, date) {
  if (!allRules || !allRules.length) return DEFAULT_RULES;
  const applicable = allRules.filter(r => r.applied_from <= date);
  return applicable.length ? applicable[applicable.length - 1] : DEFAULT_RULES;
}

// ─── PIN 변경 모달 ────────────────────────────────────────────────────────────
function PinModal({ user, onClose }) {
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSave() {
    if (!pin || pin.length < 4) { showToast('PIN은 4자리 이상이어야 합니다.', 'error'); return; }
    setSaving(true);
    try {
      await api.changePin(user.id, pin);
      showToast('비밀번호가 변경됐습니다.', 'success');
      onClose();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl">
        <h3 className="text-xl font-bold mb-1">비밀번호 변경</h3>
        <p className="text-sm text-gray-400 mb-4">{user.name} 선생님</p>
        <input
          type="text"
          inputMode="numeric"
          maxLength={8}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="새 PIN (4자리 이상)"
          className="input-field text-center text-2xl tracking-widest font-bold mb-4"
          autoFocus
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">취소</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? '변경 중...' : '변경'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── 건의하기 모달 ────────────────────────────────────────────────────────────
function SuggestionModal({ user, onClose }) {
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit() {
    if (!content.trim()) { showToast('내용을 입력해주세요.', 'error'); return; }
    setSaving(true);
    try {
      await api.submitSuggestion(content.trim(), isAnonymous);
      showToast('건의사항이 등록됐습니다!', 'success');
      onClose();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-xl">
        <h3 className="text-xl font-bold mb-4">건의(문의)사항</h3>
        <div className="space-y-4">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="건의 또는 문의 내용을 입력해주세요..."
            rows={5}
            className="w-full border-2 border-sky-200 rounded-xl px-3 py-2 text-base focus:outline-none focus:border-sky-400 resize-none"
          />
          <div className="flex items-center gap-3">
            <span className="text-gray-600 font-semibold">작성자</span>
            <div className="flex rounded-xl border-2 border-sky-200 overflow-hidden">
              <button type="button" onClick={() => setIsAnonymous(false)}
                className={`px-4 py-2 font-semibold text-base transition-colors ${!isAnonymous ? 'bg-sky-500 text-white' : 'bg-white text-gray-500'}`}>
                실명 ({user?.name})
              </button>
              <button type="button" onClick={() => setIsAnonymous(true)}
                className={`px-4 py-2 font-semibold text-base transition-colors ${isAnonymous ? 'bg-sky-500 text-white' : 'bg-white text-gray-500'}`}>
                익명
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">취소</button>
          <button onClick={handleSubmit} disabled={saving || !content.trim()} className="btn-primary flex-1">
            {saving ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 내반 명단 탭 ─────────────────────────────────────────────────────────────
function TabMyClass({ user }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    api.getStudents()
      .then(({ students }) => setStudents(students))
      .catch(e => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const regular = students.filter(s => s.type === '일반');
  const prayer = students.filter(s => s.type === '기도반');

  function StudentRow({ st }) {
    return (
      <div className="flex items-center justify-between py-3 px-1 border-b border-sky-50 last:border-0">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${st.gender === '여' ? 'bg-pink-400' : 'bg-sky-400'}`}>
            {st.name[0]}
          </div>
          <div>
            <div className="font-semibold text-gray-800">
              {st.name}
              {st.gender && <span className="text-sm text-gray-400 ml-1">{st.gender === '남' ? '♂' : '♀'}</span>}
            </div>
            {st.birthday && (
              <div className="text-sm text-gray-400">
                {new Date(st.birthday).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 생일
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          {st.phone
            ? <a href={`tel:${st.phone}`} className="text-sky-600 font-semibold text-base">{st.phone}</a>
            : <span className="text-gray-300 text-sm">전화 미등록</span>
          }
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card mb-4 flex items-center justify-between px-4 py-3">
        <span className="font-semibold text-gray-700">{user?.service} {user?.class_name}</span>
        <span className="text-gray-400 text-base">
          일반 {regular.length}명{prayer.length > 0 ? ` · 기도반 ${prayer.length}명` : ''}
        </span>
      </div>
      {regular.length > 0 && (
        <div className="card mb-4">
          <h3 className="font-bold text-sky-700 mb-2">학생 명단</h3>
          {regular.map(st => <StudentRow key={st.id} st={st} />)}
        </div>
      )}
      {prayer.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-purple-600 mb-2">기도반</h3>
          {prayer.map(st => <StudentRow key={st.id} st={st} />)}
        </div>
      )}
      {students.length === 0 && (
        <div className="text-center py-12 text-gray-400">등록된 학생이 없습니다.</div>
      )}
    </div>
  );
}

// ─── 점수 입력 폼 (공통) ──────────────────────────────────────────────────────
function ScoreForm({ students, scores, rules, onUpdate, onSave, saving, weekDate, onWeekDateChange, dateEditable = true }) {
  const unit = rules?.unit || '점';
  return (
    <>
      <div className="card mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm text-gray-500 font-semibold mb-1 block">주일 날짜</label>
          {dateEditable ? (
            <input type="date" value={weekDate} onChange={e => onWeekDateChange(e.target.value)} className="input-field" />
          ) : (
            <div className="input-field bg-gray-50 text-gray-600 cursor-default">{weekDate}</div>
          )}
        </div>
      </div>

      {rules && (
        <div className="card mb-4 flex flex-wrap gap-3 text-sm text-gray-500">
          <span>예배 {rules.worship_pts}{unit}</span>
          <span>성경지참 {rules.bible_carry_pts}{unit}</span>
          <span>암송 {rules.recitation_pts}{unit}</span>
          <span>성경읽기 {rules.bible_reading_pts}{unit}/장</span>
          <span>전도 {rules.evangelism_pts}{unit}</span>
        </div>
      )}

      {/* 데스크탑 테이블 */}
      <div className="hidden md:block card mb-4 overflow-x-auto">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b-2 border-sky-100">
              <th className="text-left py-3 px-2 text-gray-600 font-semibold w-24">이름</th>
              <th className="py-3 px-2 text-center text-gray-600 font-semibold">예배</th>
              <th className="py-3 px-2 text-center text-gray-600 font-semibold">성경<br/>지참</th>
              <th className="py-3 px-2 text-center text-gray-600 font-semibold">암송</th>
              <th className="py-3 px-2 text-center text-gray-600 font-semibold w-20">성경<br/>읽기</th>
              <th className="py-3 px-2 text-center text-gray-600 font-semibold">전도</th>
              <th className="py-3 px-2 text-left text-gray-600 font-semibold">결석사유</th>
              <th className="py-3 px-2 text-center text-sky-600 font-bold w-16">합계</th>
            </tr>
          </thead>
          <tbody>
            {students.map(st => {
              const sc = scores[st.id] || {};
              return (
                <tr key={st.id} className="border-b border-sky-50 hover:bg-sky-50/50">
                  <td className="py-3 px-2 font-semibold text-gray-800">{st.name}</td>
                  {['worship', 'bible_carry', 'recitation'].map(f => (
                    <td key={f} className="py-3 px-2 text-center">
                      <input type="checkbox" checked={!!sc[f]} onChange={e => onUpdate(st.id, f, e.target.checked)}
                        className="w-6 h-6 accent-sky-500 cursor-pointer" />
                    </td>
                  ))}
                  <td className="py-3 px-2 text-center">
                    <input type="number" min="0" max="6"
                      value={sc.bible_reading || 0}
                      onChange={e => onUpdate(st.id, 'bible_reading', Math.min(6, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-16 text-center border-2 border-sky-200 rounded-lg py-1 text-base font-bold focus:outline-none focus:border-sky-400" />
                  </td>
                  <td className="py-3 px-2 text-center">
                    <input type="checkbox" checked={!!sc.evangelism} onChange={e => onUpdate(st.id, 'evangelism', e.target.checked)}
                      className="w-6 h-6 accent-sky-500 cursor-pointer" />
                  </td>
                  <td className="py-3 px-2">
                    <input type="text" value={sc.absence_reason || ''} onChange={e => onUpdate(st.id, 'absence_reason', e.target.value)}
                      placeholder="없음" className="w-full border-2 border-sky-100 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-sky-300" />
                  </td>
                  <td className="py-3 px-2 text-center font-bold text-sky-600 text-lg">{calcTotal(sc, rules)}{unit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 */}
      <div className="md:hidden space-y-3 mb-4">
        {students.map(st => {
          const sc = scores[st.id] || {};
          return (
            <div key={st.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-bold text-gray-800">{st.name}</span>
                <span className="text-xl font-bold text-sky-600">{calcTotal(sc, rules)}{unit}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {[
                  { key: 'worship', label: '예배' }, { key: 'bible_carry', label: '성경지참' },
                  { key: 'recitation', label: '암송' }, { key: 'evangelism', label: '전도' },
                ].map(({ key, label }) => (
                  <label key={key} className={`flex items-center gap-2 min-h-[44px] px-3 rounded-xl border-2 cursor-pointer transition-colors ${sc[key] ? 'bg-sky-50 border-sky-400' : 'bg-white border-sky-100'}`}>
                    <input type="checkbox" checked={!!sc[key]} onChange={e => onUpdate(st.id, key, e.target.checked)} className="w-5 h-5 accent-sky-500" />
                    <span className="font-semibold text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">성경읽기 (장)</label>
                  <div className="flex items-center border-2 border-sky-200 rounded-xl overflow-hidden h-11">
                    <button type="button"
                      onClick={() => onUpdate(st.id, 'bible_reading', Math.max(0, (sc.bible_reading || 0) - 1))}
                      className="w-12 h-full bg-sky-50 text-sky-700 text-2xl font-bold hover:bg-sky-100 active:bg-sky-200 transition-colors">−</button>
                    <span className="flex-1 text-center text-lg font-bold text-gray-800">{sc.bible_reading || 0}장</span>
                    <button type="button"
                      onClick={() => onUpdate(st.id, 'bible_reading', Math.min(6, (sc.bible_reading || 0) + 1))}
                      className="w-12 h-full bg-sky-50 text-sky-700 text-2xl font-bold hover:bg-sky-100 active:bg-sky-200 transition-colors">+</button>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-500 mb-1 block">결석사유</label>
                  <input type="text" value={sc.absence_reason || ''} onChange={e => onUpdate(st.id, 'absence_reason', e.target.value)}
                    placeholder="없음" className="input-field" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-4">
        <button onClick={onSave} disabled={saving} className="btn-primary w-full text-xl shadow-lg">
          {saving ? '저장 중...' : '전체 저장'}
        </button>
      </div>

      <div className="card mt-4">
        <h3 className="font-bold text-gray-600 mb-3">이번 주 점수 요약</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {students.map(st => {
            const sc = scores[st.id] || {};
            return (
              <div key={st.id} className="flex justify-between items-center bg-sky-50 rounded-xl px-3 py-2">
                <span className="font-semibold text-gray-700">{st.name}</span>
                <span className="font-bold text-sky-600">{calcTotal(sc, rules)}{unit}</span>
              </div>
            );
          })}
        </div>
        {students.length > 0 && (
          <div className="mt-3 pt-3 border-t border-sky-100 flex justify-between">
            <span className="font-bold text-gray-600">반 평균</span>
            <span className="font-bold text-sky-700 text-lg">
              {(students.reduce((s, st) => s + calcTotal(scores[st.id] || {}, rules), 0) / students.length).toFixed(1)}{unit}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
export default function Teacher() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  // ── 공통 UI 상태 ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(0); // 0:점수입력 1:점수현황 2:내반명단
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── 임원(admin) 뷰 상태 ────────────────────────────────────────────────────
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [weekDate, setWeekDate] = useState(getSunday());
  const [students, setStudents] = useState([]);
  const [scores, setScores] = useState({});
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(false);

  // ── 반선생님 탭0: 점수 입력 상태 ──────────────────────────────────────────
  const [inputWeekDate, setInputWeekDate] = useState(getSunday());
  const [inputStudents, setInputStudents] = useState([]);
  const [inputScores, setInputScores] = useState({});
  const [inputRules, setInputRules] = useState(null);
  const [inputLoading, setInputLoading] = useState(false);

  // ── 반선생님 탭1: 점수 현황 상태 ──────────────────────────────────────────
  const [history, setHistory] = useState({ students: [], scores: [], rules: [] });
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── 임원: 선생님 목록 로드 ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    api.getUsers().then(({ users }) => {
      const list = users.filter(u => u.role === 'teacher');
      setTeachers(list);
      if (list.length > 0) setSelectedTeacher(list[0]);
    }).catch(() => {});
  }, [isAdmin]);

  // ── 임원: 선택된 반/날짜 변경 시 점수 로드 ───────────────────────────────
  useEffect(() => {
    if (!isAdmin || !selectedTeacher) return;
    const cls = selectedTeacher?.class_name;
    const svc = selectedTeacher?.service;
    if (!cls) return;
    loadAdminScores(cls, svc);
  }, [weekDate, selectedTeacher, isAdmin]);

  async function loadAdminScores(cls, svc) {
    setLoading(true);
    try {
      const { students: list, scores: scoreArr, rules: r } = await api.getScores(weekDate, cls, svc);
      setStudents(list);
      setRules(r);
      const map = {};
      scoreArr.forEach(s => { map[s.student_id] = s; });
      list.forEach(st => {
        if (!map[st.id]) map[st.id] = { student_id: st.id, week_date: weekDate, worship: false, bible_carry: false, recitation: false, bible_reading: 0, evangelism: false, absence_reason: '' };
      });
      setScores(map);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function adminUpdate(studentId, field, value) {
    setScores(p => ({ ...p, [studentId]: { ...p[studentId], [field]: value } }));
  }

  async function handleAdminSave() {
    setSaving(true);
    try {
      const list = Object.values(scores).map(s => ({ ...s, week_date: weekDate, bible_reading: parseInt(s.bible_reading) || 0 }));
      await api.saveScores(list);
      showToast('점수가 저장되었습니다!', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── 반선생님 탭0: 날짜 변경 시 점수 로드 ──────────────────────────────────
  useEffect(() => {
    if (isAdmin) return;
    loadInputScores(inputWeekDate);
  }, [inputWeekDate, isAdmin]);

  async function loadInputScores(wd) {
    setInputLoading(true);
    try {
      const { students: list, scores: scoreArr, rules: r } = await api.getScores(wd, user?.class_name, user?.service);
      setInputStudents(list);
      setInputRules(r);
      const map = {};
      scoreArr.forEach(s => { map[s.student_id] = s; });
      list.forEach(st => {
        if (!map[st.id]) map[st.id] = { student_id: st.id, week_date: wd, worship: false, bible_carry: false, recitation: false, bible_reading: 0, evangelism: false, absence_reason: '' };
      });
      setInputScores(map);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setInputLoading(false);
    }
  }

  function inputUpdate(studentId, field, value) {
    setInputScores(p => ({ ...p, [studentId]: { ...p[studentId], [field]: value } }));
  }

  async function handleInputSave() {
    setSaving(true);
    try {
      const list = Object.values(inputScores).map(s => ({ ...s, week_date: inputWeekDate, bible_reading: parseInt(s.bible_reading) || 0 }));
      await api.saveScores(list);
      showToast('점수가 저장되었습니다!', 'success');
      loadHistory();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── 반선생님 탭1: 히스토리 로드 (탭 전환 시) ──────────────────────────────
  useEffect(() => {
    if (isAdmin || activeTab !== 1) return;
    loadHistory();
  }, [activeTab, isAdmin]);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const data = await api.getScoreHistory(user?.class_name, user?.service);
      setHistory(data);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setHistoryLoading(false);
    }
  }

  // ── 히스토리 계산 ──────────────────────────────────────────────────────────
  const historyStudents = history.students;
  const weekMap = {};
  history.scores.forEach(sc => {
    if (!weekMap[sc.week_date]) weekMap[sc.week_date] = {};
    weekMap[sc.week_date][sc.student_id] = sc;
  });
  const historyWeeks = Object.keys(weekMap).sort().reverse();

  const studentTotals = {};
  historyStudents.forEach(st => { studentTotals[st.id] = 0; });
  historyWeeks.forEach(wd => {
    const r = getRulesForDate(history.rules, wd);
    historyStudents.forEach(st => {
      studentTotals[st.id] += calcTotal((weekMap[wd] || {})[st.id] || {}, r);
    });
  });

  const latestUnit = historyWeeks.length ? getRulesForDate(history.rules, historyWeeks[0])?.unit || '점' : '점';

  const classInfo = isAdmin && selectedTeacher
    ? `${selectedTeacher.service} ${selectedTeacher.class_name}`
    : `${user?.service || ''} ${user?.class_name || ''}`;

  // 점수현황 탭에서 수정 버튼 클릭 시 → 점수입력 탭으로 이동
  function goToEditWeek(wd) {
    setInputWeekDate(wd);
    setActiveTab(0);
  }

  return (
    <div className="min-h-screen bg-sky-50">
      <header className="bg-sky-500 text-white px-4 py-4 shadow-md">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{user?.name} {isAdmin ? '임원' : '선생님'}</h1>
              <p className="text-sky-100 text-base">{classInfo}</p>
            </div>
            <div className="flex gap-3 items-center">
              {isAdmin && (
                <button onClick={() => navigate('/admin')} className="text-sky-100 text-base underline">대시보드</button>
              )}
              {!isAdmin && (
                <button onClick={() => setShowPinModal(true)} className="text-sky-100 text-base underline">비밀번호변경</button>
              )}
              <button onClick={() => setShowSuggestionModal(true)} className="text-sky-100 text-base underline">건의하기</button>
              <button onClick={() => { logout(); navigate('/login'); }} className="text-sky-100 text-base underline">로그아웃</button>
            </div>
          </div>
        </div>
      </header>

      {/* 탭 (반선생님만) */}
      {!isAdmin && (
        <div className="bg-white border-b border-sky-100 shadow-sm">
          <div className="max-w-3xl mx-auto flex">
            {['점수 입력', '점수 현황', '내반 명단'].map((tab, i) => (
              <button key={tab} onClick={() => setActiveTab(i)}
                className={`flex-1 py-3 font-semibold text-base border-b-2 transition-colors ${
                  activeTab === i ? 'text-sky-600 border-sky-500' : 'text-gray-500 border-transparent'
                }`}>
                {tab}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 임원 뷰 ─────────────────────────────────────────────────────────── */}
      {isAdmin && (
        <main className="max-w-3xl mx-auto px-3 py-4">
          <div className="card mb-4 flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-gray-500 font-semibold mb-1 block">주일 날짜</label>
              <input type="date" value={weekDate} onChange={e => setWeekDate(e.target.value)} className="input-field" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-gray-500 font-semibold mb-1 block">반 선택</label>
              <select className="input-field" value={selectedTeacher?.id || ''}
                onChange={e => setSelectedTeacher(teachers.find(t => t.id === e.target.value) || null)}>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.service} {t.class_name} ({t.name})</option>
                ))}
              </select>
            </div>
          </div>
          {loading ? (
            <Spinner size="lg" />
          ) : students.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-lg">등록된 학생이 없습니다.</div>
          ) : (
            <ScoreForm
              students={students}
              scores={scores}
              rules={rules}
              onUpdate={adminUpdate}
              onSave={handleAdminSave}
              saving={saving}
              weekDate={weekDate}
              onWeekDateChange={setWeekDate}
              dateEditable={false}
            />
          )}
        </main>
      )}

      {/* ── 반선생님 탭0: 점수 입력 ─────────────────────────────────────────── */}
      {!isAdmin && activeTab === 0 && (
        <main className="max-w-3xl mx-auto px-3 py-4">
          {inputLoading ? (
            <Spinner size="lg" />
          ) : inputStudents.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-lg">등록된 학생이 없습니다.</div>
          ) : (
            <ScoreForm
              students={inputStudents}
              scores={inputScores}
              rules={inputRules}
              onUpdate={inputUpdate}
              onSave={handleInputSave}
              saving={saving}
              weekDate={inputWeekDate}
              onWeekDateChange={setInputWeekDate}
              dateEditable={true}
            />
          )}
        </main>
      )}

      {/* ── 반선생님 탭1: 점수 현황 ─────────────────────────────────────────── */}
      {!isAdmin && activeTab === 1 && (
        <main className="max-w-3xl mx-auto px-3 py-4">
          {historyLoading ? (
            <Spinner size="lg" />
          ) : (
            <div>
              {/* 전체 누적 점수 */}
              <div className="card mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-700 text-lg">전체 누적 점수</h3>
                  <span className="text-sm text-gray-400">{historyWeeks.length}주 누적</span>
                </div>
                {historyStudents.length === 0 ? (
                  <p className="text-gray-400 text-base text-center py-2">아직 입력된 점수가 없습니다.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {historyStudents.slice().sort((a, b) => studentTotals[b.id] - studentTotals[a.id]).map(st => (
                        <div key={st.id} className="flex justify-between items-center bg-sky-50 rounded-xl px-3 py-2">
                          <span className="font-semibold text-gray-700">{st.name}</span>
                          <span className="font-bold text-sky-600">{studentTotals[st.id]}{latestUnit}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-sky-100 flex justify-between">
                      <span className="font-bold text-gray-600">반 합계</span>
                      <span className="font-bold text-sky-700 text-lg">
                        {Object.values(studentTotals).reduce((s, v) => s + v, 0)}{latestUnit}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* 주별 점수 내역 */}
              {historyWeeks.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-gray-600 px-1">주별 점수 내역</h3>
                  {historyWeeks.map(wd => {
                    const r = getRulesForDate(history.rules, wd);
                    const unit = r?.unit || '점';
                    const weekStudents = historyStudents.slice().sort((a, b) =>
                      calcTotal((weekMap[wd] || {})[b.id] || {}, r) - calcTotal((weekMap[wd] || {})[a.id] || {}, r)
                    );
                    const weekTotal = historyStudents.reduce((s, st) => s + calcTotal((weekMap[wd] || {})[st.id] || {}, r), 0);
                    return (
                      <div key={wd} className="card">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <span className="font-bold text-gray-700">{wd}</span>
                            <span className="text-sm text-gray-400 ml-2">반 합계 {weekTotal}{unit}</span>
                          </div>
                          <button
                            onClick={() => goToEditWeek(wd)}
                            className="px-3 py-1.5 bg-sky-100 text-sky-700 rounded-lg text-sm font-semibold hover:bg-sky-200 active:bg-sky-300 transition-colors">
                            수정
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {weekStudents.map(st => {
                            const sc = (weekMap[wd] || {})[st.id] || {};
                            return (
                              <div key={st.id} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-1.5">
                                <span className="text-gray-700 font-medium">{st.name}</span>
                                <span className="font-semibold text-sky-600">{calcTotal(sc, r)}{unit}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* ── 반선생님 탭2: 내반 명단 ─────────────────────────────────────────── */}
      {!isAdmin && activeTab === 2 && (
        <main className="max-w-3xl mx-auto px-3 py-4">
          <TabMyClass user={user} />
        </main>
      )}

      {showPinModal && <PinModal user={user} onClose={() => setShowPinModal(false)} />}
      {showSuggestionModal && <SuggestionModal user={user} onClose={() => setShowSuggestionModal(false)} />}
    </div>
  );
}
