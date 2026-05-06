import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Spinner from '../components/Spinner';
import { api } from '../lib/api';

function today() { return new Date().toISOString().split('T')[0]; }
function getSunday() {
  const d = new Date(); const day = d.getDay();
  const sun = new Date(d); sun.setDate(d.getDate() - day);
  return sun.toISOString().split('T')[0];
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

const ALL_TABS = ['주간출석', '출석체크', '점수현황', '새친구관리', '반이동', '생일조회', '점수기준', '학생관리', '선생님관리', '건의사항'];

function getVisibleTabs(position) {
  if (position === '행정팀') return ['주간출석', '점수현황', '새친구관리', '생일조회'];
  if (position === '임원') return ['주간출석', '출석체크', '점수현황', '새친구관리', '반이동', '생일조회', '학생관리', '선생님관리', '건의사항'];
  return ALL_TABS;
}

// ─── Tab: 주간출석 ────────────────────────────────────────────────────────────
function TabAttendance() {
  const [date, setDate] = useState(today());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function load() {
    setLoading(true);
    try { const { summary } = await api.getAttendanceSummary(date); setSummary(summary); }
    catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [date]);

  const Card = ({ label, data, color }) => (
    <div className={`card flex flex-col items-center justify-center p-5 border-l-4 ${color}`}>
      <div className="text-base text-gray-500 mb-1">{label}</div>
      <div className="text-4xl font-bold text-gray-800">{data?.attended ?? 0}</div>
      <div className="text-base text-gray-400">/ {data?.total ?? 0}명</div>
      {data && data.total > 0 && (
        <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
          <div className="bg-sky-400 h-2 rounded-full transition-all" style={{ width: `${(data.attended / data.total) * 100}%` }} />
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="card mb-4 flex items-center gap-3">
        <label className="font-semibold text-gray-600">날짜</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field max-w-[180px]" />
        <button onClick={load} className="btn-primary px-4 py-2 min-h-0 text-base">조회</button>
      </div>
      {loading ? <Spinner /> : summary && (
        <div className="space-y-6">
          {['1부', '2부'].map(svc => (
            <div key={svc}>
              <h3 className="text-lg font-bold text-sky-700 mb-3">{svc}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card label={`${svc} 3학년`} data={summary[svc]?.['3학년']} color="border-sky-400" />
                <Card label={`${svc} 4학년`} data={summary[svc]?.['4학년']} color="border-blue-400" />
                <Card label={`${svc} 새친구`} data={summary[svc]?.['새친구']} color="border-orange-400" />
                <Card label={`${svc} 기도반`} data={summary[svc]?.['기도반']} color="border-purple-400" />
              </div>
            </div>
          ))}
          <div className="card bg-sky-500 text-white flex items-center justify-between px-6 py-4">
            <span className="text-lg font-bold">전체 출석</span>
            <span className="text-3xl font-bold">
              {['1부', '2부'].reduce((sum, svc) =>
                sum + Object.values(summary[svc] || {}).reduce((s, v) => s + (v.attended || 0), 0), 0)}명
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: 출석체크 (관리자용) ─────────────────────────────────────────────────
function TabAdminAttendance() {
  const [date, setDate] = useState(today());
  const [service, setService] = useState('1부');
  const [students, setStudents] = useState([]);
  const [attended, setAttended] = useState(new Set());
  const [pending, setPending] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getAttendance(date, service)
      .then(({ students: list, attendance }) => {
        if (cancelled) return;
        setStudents(list);
        setAttended(new Set(attendance));
      })
      .catch(e => showToast(e.message, 'error'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, service]);

  async function toggle(studentId) {
    if (pending.has(studentId)) return;
    const isChecked = attended.has(studentId);
    setPending(p => new Set([...p, studentId]));
    setAttended(prev => { const next = new Set(prev); isChecked ? next.delete(studentId) : next.add(studentId); return next; });
    try {
      let result;
      if (isChecked) result = await api.unmarkAttendance(studentId, date);
      else result = await api.markAttendance(studentId, date);
      if (result?.student_update) {
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, ...result.student_update } : s));
      }
    } catch (e) {
      setAttended(prev => { const next = new Set(prev); isChecked ? next.add(studentId) : next.delete(studentId); return next; });
      showToast(e.message, 'error');
    } finally {
      setPending(p => { const n = new Set(p); n.delete(studentId); return n; });
    }
  }

  const regularStudents = students.filter(s => s.type === '일반');
  const newFriends = students.filter(s => s.type === '새친구');
  const prayerStudents = students.filter(s => s.type === '기도반');
  const groups = groupByClass(regularStudents);
  const prayerGroups = groupByClass(prayerStudents);
  const totalAttended = [...attended].filter(id => students.find(s => s.id === id)).length;

  function SBtn({ s, ac, ab }) {
    const isChecked = attended.has(s.id);
    const isPending = pending.has(s.id);
    return (
      <button onClick={() => toggle(s.id)} disabled={isPending}
        className={`min-h-[44px] rounded-xl font-semibold text-base transition-all border-2 flex items-center justify-center gap-1 ${
          isChecked ? `${ac} shadow-sm` : `bg-white ${ab} text-gray-700`} ${isPending ? 'opacity-60' : ''}`}>
        {isChecked && <span className="text-sm">✅</span>}
        <span>{s.name}</span>
        {s.gender && <span className={`text-xs ${isChecked ? 'text-white/70' : 'text-gray-400'}`}>{s.gender === '남' ? '♂' : '♀'}</span>}
      </button>
    );
  }

  return (
    <div>
      <div className="card mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-sm text-gray-500 block mb-1">날짜</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field max-w-[180px]" />
        </div>
        <div className="flex rounded-xl border-2 border-sky-200 overflow-hidden">
          {['1부', '2부'].map(s => (
            <button key={s} onClick={() => setService(s)}
              className={`px-6 py-2 font-bold text-base transition-colors ${service === s ? 'bg-sky-500 text-white' : 'bg-white text-gray-500'}`}>{s}</button>
          ))}
        </div>
        <span className="text-sky-600 font-semibold">출석 {totalAttended}명 / {students.length}명</span>
      </div>

      {loading ? <Spinner /> : (
        <>
          {groups.map(group => (
            <section key={group.class_name} className="mb-5">
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-sky-700 font-bold">{group.class_name}</span>
                <span className="text-gray-500 text-sm">{group.teacher_name} 선생님</span>
                <span className="ml-auto text-sky-600 font-semibold text-sm">
                  {group.students.filter(s => attended.has(s.id)).length}/{group.students.length}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {group.students.map(s => <SBtn key={s.id} s={s} ac="bg-sky-500 border-sky-500 text-white" ab="border-sky-200" />)}
              </div>
            </section>
          ))}

          <section className="mb-5">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-orange-500 font-bold">새친구</span>
              {newFriends.length > 0 && <span className="text-orange-400 text-sm">{newFriends.filter(s => attended.has(s.id)).length}/{newFriends.length}</span>}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {newFriends.map(s => {
                const isChecked = attended.has(s.id);
                const isPending = pending.has(s.id);
                const visitCount = [s.registered_at, s.visit_date_2, s.visit_date_3, s.visit_date_4, s.visit_date_5, s.visit_date_6].filter(Boolean).length;
                return (
                  <button key={s.id} onClick={() => toggle(s.id)} disabled={isPending}
                    className={`min-h-[44px] rounded-xl font-semibold text-base flex flex-col items-center justify-center border-2 transition-all ${
                      isChecked ? 'bg-orange-400 border-orange-400 text-white shadow-sm' : 'bg-white border-orange-200 text-gray-700'
                    } ${isPending ? 'opacity-60' : ''}`}>
                    <span>{isChecked ? '✅ ' : ''}{s.name}</span>
                    <span className={`text-xs ${isChecked ? 'text-orange-100' : 'text-orange-400'}`}>{visitCount}회</span>
                  </button>
                );
              })}
              {newFriends.length === 0 && <p className="col-span-3 text-center text-gray-400 text-sm py-3">새친구 없음</p>}
            </div>
          </section>

          {prayerStudents.length > 0 && (
            <section className="mb-5">
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-purple-600 font-bold">기도반</span>
                <span className="text-purple-400 text-sm">{prayerStudents.filter(s => attended.has(s.id)).length}/{prayerStudents.length}</span>
              </div>
              {prayerGroups.map(group => (
                <div key={group.class_name} className="mb-3">
                  <p className="text-xs text-purple-500 font-semibold px-1 mb-1">{group.class_name} · {group.teacher_name}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {group.students.map(s => <SBtn key={s.id} s={s} ac="bg-purple-500 border-purple-500 text-white" ab="border-purple-200" />)}
                  </div>
                </div>
              ))}
            </section>
          )}

          {students.length === 0 && (
            <div className="text-center py-12 text-gray-400">등록된 학생이 없습니다.</div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab: 점수현황 ────────────────────────────────────────────────────────────
function TabScores() {
  const [mode, setMode] = useState('single');
  const [weekDate, setWeekDate] = useState(getSunday());
  const [startDate, setStartDate] = useState(getSunday());
  const [endDate, setEndDate] = useState(getSunday());
  const [sort, setSort] = useState('class');
  const [students, setStudents] = useState([]);
  const [rules, setRules] = useState(null);
  const [resultMode, setResultMode] = useState('single');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const res = mode === 'range'
        ? await api.getAdminScores(null, sort, startDate, endDate)
        : await api.getAdminScores(weekDate, sort);
      setStudents(res.students);
      setRules(res.rules);
      setResultMode(res.mode || 'single');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const unit = rules?.unit || '점';
  const check = v => v ? '✅' : '—';

  return (
    <div>
      <div className="card mb-4 space-y-3">
        <div className="flex rounded-xl border-2 border-sky-200 overflow-hidden w-fit">
          {[['single', '단일 날짜'], ['range', '날짜 범위']].map(([v, l]) => (
            <button key={v} onClick={() => setMode(v)}
              className={`px-4 py-2 font-semibold text-base transition-colors ${mode === v ? 'bg-sky-500 text-white' : 'bg-white text-gray-500'}`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          {mode === 'single' ? (
            <div>
              <label className="text-sm text-gray-500 block mb-1">주일 날짜</label>
              <input type="date" value={weekDate} onChange={e => setWeekDate(e.target.value)} className="input-field max-w-[180px]" />
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm text-gray-500 block mb-1">시작일</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field max-w-[180px]" />
              </div>
              <span className="text-gray-400 pb-2">~</span>
              <div>
                <label className="text-sm text-gray-500 block mb-1">종료일</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field max-w-[180px]" />
              </div>
            </>
          )}
          <div>
            <label className="text-sm text-gray-500 block mb-1">정렬</label>
            <select value={sort} onChange={e => setSort(e.target.value)} className="input-field max-w-[160px]">
              <option value="class">반별</option>
              <option value="score">점수순</option>
            </select>
          </div>
          <button onClick={load} className="btn-primary px-4 py-2 min-h-0 text-base">조회</button>
        </div>
      </div>
      {rules && (
        <div className="card mb-3 flex flex-wrap gap-3 text-sm text-gray-500">
          <span>예배 {rules.worship_pts}{unit}</span>
          <span>성경지참 {rules.bible_carry_pts}{unit}</span>
          <span>암송 {rules.recitation_pts}{unit}</span>
          <span>성경읽기 {rules.bible_reading_pts}{unit}/장</span>
          <span>전도 {rules.evangelism_pts}{unit}</span>
        </div>
      )}
      {loading ? <Spinner /> : (
        <div className="card overflow-x-auto">
          {resultMode === 'range' ? (
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b-2 border-sky-100 text-gray-500">
                  <th className="text-left py-3 px-2">반</th><th className="text-left py-3 px-2">이름</th>
                  <th className="text-center py-3 px-2">예배<br/><span className="text-xs font-normal">횟수</span></th>
                  <th className="text-center py-3 px-2">성경지참<br/><span className="text-xs font-normal">횟수</span></th>
                  <th className="text-center py-3 px-2">암송<br/><span className="text-xs font-normal">횟수</span></th>
                  <th className="text-center py-3 px-2">성경읽기<br/><span className="text-xs font-normal">합계(장)</span></th>
                  <th className="text-center py-3 px-2">전도<br/><span className="text-xs font-normal">횟수</span></th>
                  <th className="text-center py-3 px-2 text-sky-600 font-bold">누적<br/>{unit}</th>
                </tr>
              </thead>
              <tbody>
                {students.map(st => (
                  <tr key={st.id} className="border-b border-sky-50 hover:bg-sky-50/50">
                    <td className="py-2 px-2 text-gray-500 text-xs">{st.service} {st.class_name}</td>
                    <td className="py-2 px-2 font-semibold">{st.name}</td>
                    <td className="py-2 px-2 text-center">{st.agg?.worship || 0}</td>
                    <td className="py-2 px-2 text-center">{st.agg?.bible_carry || 0}</td>
                    <td className="py-2 px-2 text-center">{st.agg?.recitation || 0}</td>
                    <td className="py-2 px-2 text-center">{st.agg?.bible_reading || 0}</td>
                    <td className="py-2 px-2 text-center">{st.agg?.evangelism || 0}</td>
                    <td className="py-2 px-2 text-center font-bold text-sky-600 text-base">{st.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b-2 border-sky-100 text-gray-500">
                  <th className="text-left py-3 px-2">반</th><th className="text-left py-3 px-2">이름</th>
                  <th className="text-center py-3 px-2">예배</th><th className="text-center py-3 px-2">성경지참</th>
                  <th className="text-center py-3 px-2">암송</th><th className="text-center py-3 px-2">성경읽기</th>
                  <th className="text-center py-3 px-2">전도</th>
                  <th className="text-center py-3 px-2 text-sky-600 font-bold">합계<br/><span className="text-xs font-normal">{unit}</span></th>
                  <th className="text-left py-3 px-2">결석사유</th>
                </tr>
              </thead>
              <tbody>
                {students.map(st => (
                  <tr key={st.id} className="border-b border-sky-50 hover:bg-sky-50/50">
                    <td className="py-2 px-2 text-gray-500 text-xs">{st.service} {st.class_name}</td>
                    <td className="py-2 px-2 font-semibold">{st.name}</td>
                    <td className="py-2 px-2 text-center">{check(st.score?.worship)}</td>
                    <td className="py-2 px-2 text-center">{check(st.score?.bible_carry)}</td>
                    <td className="py-2 px-2 text-center">{check(st.score?.recitation)}</td>
                    <td className="py-2 px-2 text-center">{st.score?.bible_reading || 0}</td>
                    <td className="py-2 px-2 text-center">{check(st.score?.evangelism)}</td>
                    <td className="py-2 px-2 text-center font-bold text-sky-600 text-base">{st.total}</td>
                    <td className="py-2 px-2 text-gray-400 text-xs">{st.score?.absence_reason || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {students.length === 0 && <p className="text-center py-8 text-gray-400">데이터가 없습니다.</p>}
        </div>
      )}
    </div>
  );
}

// ─── Tab: 새친구관리 ──────────────────────────────────────────────────────────
function TabNewFriends() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registerModal, setRegisterModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [regForm, setRegForm] = useState({ service: '1부', grade: 3, class_name: '', teacher_name: '' });
  const [detailForm, setDetailForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function load() {
    setLoading(true);
    try { const { students } = await api.getNewFriends(); setStudents(students); }
    catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function openDetail(st) {
    setDetailModal(st);
    setDetailForm({
      friend_type: st.friend_type || '',
      recruiter_name: st.recruiter_name || '',
      recruiter_service: st.recruiter_service || '1부',
      recruiter_grade: st.recruiter_grade || 3,
      recruiter_class: st.recruiter_class || '',
      registered_at: st.registered_at || '',
      visit_date_2: st.visit_date_2 || '',
      visit_date_3: st.visit_date_3 || '',
      visit_date_4: st.visit_date_4 || '',
      visit_date_5: st.visit_date_5 || '',
      visit_date_6: st.visit_date_6 || '',
    });
  }

  async function handleSaveDetail() {
    setSaving(true);
    try {
      const payload = {
        friend_type: detailForm.friend_type || null,
        recruiter_name: detailForm.recruiter_name || null,
        recruiter_service: detailForm.recruiter_service || null,
        recruiter_grade: detailForm.recruiter_grade ? parseInt(detailForm.recruiter_grade) : null,
        recruiter_class: detailForm.recruiter_class || null,
        registered_at: detailForm.registered_at || null,
        visit_date_2: detailForm.visit_date_2 || null,
        visit_date_3: detailForm.visit_date_3 || null,
        visit_date_4: detailForm.visit_date_4 || null,
        visit_date_5: detailForm.visit_date_5 || null,
        visit_date_6: detailForm.visit_date_6 || null,
      };
      await api.updateStudent(detailModal.id, payload);
      showToast('저장됐습니다.', 'success');
      setDetailModal(null);
      load();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleRegister() {
    if (!regForm.class_name || !regForm.teacher_name) {
      showToast('반과 선생님을 입력해주세요.', 'error'); return;
    }
    setSaving(true);
    try {
      await api.registerNewFriend(registerModal.id, regForm);
      showToast(`${registerModal.name} 학생이 정식 등록되었습니다!`, 'success');
      setRegisterModal(null);
      load();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;

  const visitLabels = ['등록(1회)', '2회', '3회', '4회', '5회', '6회'];
  const visitKeys = ['registered_at', 'visit_date_2', 'visit_date_3', 'visit_date_4', 'visit_date_5', 'visit_date_6'];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-500">총 {students.length}명</p>
        <button onClick={load} className="btn-secondary px-4 py-2 min-h-0 text-base">새로고침</button>
      </div>
      <div className="space-y-3">
        {students.map(st => {
          const filledVisits = visitKeys.filter(k => st[k]).length;
          const recruiterInfo = st.recruiter_name
            ? `${st.recruiter_service || ''} ${st.recruiter_grade ? st.recruiter_grade + '학년' : ''} ${st.recruiter_class || ''} ${st.recruiter_name}`
            : null;
          return (
            <div key={st.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <span className="font-bold text-gray-800 text-lg">{st.name}</span>
                    {st.gender && <span className="text-sm text-gray-400">{st.gender}</span>}
                    <span className={`text-sm px-2 py-0.5 rounded-full ${st.service === '1부' ? 'bg-sky-100 text-sky-600' : 'bg-blue-100 text-blue-600'}`}>{st.service}</span>
                    {st.friend_type && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        st.friend_type === '기신자' ? 'bg-purple-100 text-purple-600' : 'bg-teal-100 text-teal-600'
                      }`}>{st.friend_type}</span>
                    )}
                    <span className={`text-sm font-semibold ${filledVisits >= 3 ? 'text-green-600' : 'text-orange-500'}`}>
                      {filledVisits}회 방문{filledVisits >= 3 ? ' 🎉' : ''}
                    </span>
                  </div>
                  {recruiterInfo && (
                    <p className="text-sm text-indigo-600 mb-1">전도자: {recruiterInfo.trim()}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {visitKeys.map((k, i) => st[k] && (
                      <span key={k} className="text-xs text-gray-400">{visitLabels[i]}: {st[k]}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openDetail(st)} className="btn-secondary px-3 py-1.5 min-h-0 text-sm">정보편집</button>
                  <button
                    onClick={() => { setRegisterModal(st); setRegForm(f => ({ ...f, service: st.service })); }}
                    className="btn-primary px-3 py-1.5 min-h-0 text-sm"
                  >정식등록</button>
                </div>
              </div>
            </div>
          );
        })}
        {students.length === 0 && <p className="text-center py-12 text-gray-400 text-lg">새친구가 없습니다.</p>}
      </div>

      {/* 새친구 상세 편집 모달 */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4 overflow-y-auto">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-xl my-0 sm:my-4">
            <h3 className="text-xl font-bold mb-4">{detailModal.name} — 방문 정보</h3>
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1 block">기신자/초신자</label>
                <div className="flex gap-2">
                  {['', '초신자', '기신자'].map(t => (
                    <button key={t} type="button" onClick={() => setDetailForm(f => ({ ...f, friend_type: t }))}
                      className={`flex-1 min-h-[40px] rounded-xl font-semibold text-sm border-2 transition-colors ${
                        detailForm.friend_type === t ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white border-sky-200 text-gray-600'
                      }`}>
                      {t === '' ? '미지정' : t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-indigo-50 rounded-xl p-3">
                <p className="text-sm font-semibold text-indigo-700 mb-2">전도자 정보</p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">예배</label>
                    <select value={detailForm.recruiter_service} onChange={e => setDetailForm(f => ({ ...f, recruiter_service: e.target.value }))} className="input-field text-sm py-1.5">
                      <option value="">—</option>
                      <option value="1부">1부</option>
                      <option value="2부">2부</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">학년</label>
                    <select value={detailForm.recruiter_grade} onChange={e => setDetailForm(f => ({ ...f, recruiter_grade: e.target.value }))} className="input-field text-sm py-1.5">
                      <option value="">—</option>
                      <option value="3">3학년</option>
                      <option value="4">4학년</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">반</label>
                    <input type="text" value={detailForm.recruiter_class} onChange={e => setDetailForm(f => ({ ...f, recruiter_class: e.target.value }))} placeholder="예: 3-1반" className="input-field text-sm py-1.5" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">전도자 이름</label>
                  <input type="text" value={detailForm.recruiter_name} onChange={e => setDetailForm(f => ({ ...f, recruiter_name: e.target.value }))} placeholder="이름" className="input-field" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">방문 날짜</p>
                <div className="space-y-2">
                  {visitKeys.map((k, i) => (
                    <div key={k} className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 w-16 shrink-0">{visitLabels[i]}</span>
                      <input type="date" value={detailForm[k] || ''} onChange={e => setDetailForm(f => ({ ...f, [k]: e.target.value }))} className="input-field flex-1" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDetailModal(null)} className="btn-secondary flex-1">취소</button>
              <button onClick={handleSaveDetail} disabled={saving} className="btn-primary flex-1">{saving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 정식 등록 모달 */}
      {registerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-xl font-bold mb-4">{registerModal.name} 정식 등록</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500 block mb-1">예배</label>
                <select value={regForm.service} onChange={e => setRegForm(f => ({ ...f, service: e.target.value }))} className="input-field">
                  <option value="1부">1부</option><option value="2부">2부</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">학년</label>
                <select value={regForm.grade} onChange={e => setRegForm(f => ({ ...f, grade: parseInt(e.target.value) }))} className="input-field">
                  <option value={3}>3학년</option><option value={4}>4학년</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">반 이름</label>
                <input type="text" value={regForm.class_name} onChange={e => setRegForm(f => ({ ...f, class_name: e.target.value }))} placeholder="예: 3-1반" className="input-field" />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">담당 선생님</label>
                <input type="text" value={regForm.teacher_name} onChange={e => setRegForm(f => ({ ...f, teacher_name: e.target.value }))} placeholder="선생님 이름" className="input-field" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setRegisterModal(null)} className="btn-secondary flex-1">취소</button>
              <button onClick={handleRegister} disabled={saving} className="btn-primary flex-1">{saving ? '저장 중...' : '등록'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: 반이동 ──────────────────────────────────────────────────────────────
function TabTransfer() {
  const [allStudents, setAllStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ service: '', grade: '', class_name: '', teacher_name: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    api.getStudents()
      .then(({ students }) => setAllStudents(students))
      .catch(e => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  function selectStudent(st) {
    setSelected(st);
    setForm({ service: st.service, grade: st.grade, class_name: st.class_name, teacher_name: st.teacher_name });
  }

  async function handleTransfer() {
    if (!form.class_name || !form.teacher_name) {
      showToast('반과 선생님을 입력해주세요.', 'error'); return;
    }
    setSaving(true);
    try {
      await api.transferStudent(selected.id, form);
      showToast(`${selected.name} 학생이 ${form.service} ${form.class_name}으로 이동됐습니다.`, 'success');
      const { students } = await api.getStudents();
      setAllStudents(students);
      setSelected(null);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  const filtered = search ? allStudents.filter(s => s.name.includes(search) || s.class_name.includes(search)) : allStudents;
  if (loading) return <Spinner />;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="학생 이름 또는 반 검색..." className="input-field mb-3" />
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {filtered.map(st => (
            <button key={st.id} onClick={() => selectStudent(st)}
              className={`w-full text-left card flex items-center justify-between transition-colors ${selected?.id === st.id ? 'border-sky-400 bg-sky-50' : 'hover:bg-sky-50/50'}`}>
              <div>
                <span className="font-semibold text-gray-800">{st.name}</span>
                <span className="text-sm text-gray-500 ml-2">{st.gender}</span>
              </div>
              <span className="text-sm text-gray-400">{st.service} {st.class_name}</span>
            </button>
          ))}
        </div>
      </div>
      {selected ? (
        <div className="card h-fit">
          <h3 className="font-bold text-lg mb-1">{selected.name} 반 이동</h3>
          <p className="text-sm text-gray-400 mb-4">현재: {selected.service} {selected.class_name} ({selected.teacher_name})</p>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-500 block mb-1">예배</label>
              <select value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} className="input-field">
                <option value="1부">1부</option><option value="2부">2부</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1">학년</label>
              <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: parseInt(e.target.value) }))} className="input-field">
                <option value={3}>3학년</option><option value={4}>4학년</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1">새 반 이름</label>
              <input type="text" value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1">새 담당 선생님</label>
              <input type="text" value={form.teacher_name} onChange={e => setForm(f => ({ ...f, teacher_name: e.target.value }))} className="input-field" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3 mb-4">* 기존 점수 데이터는 유지됩니다.</p>
          <div className="flex gap-3">
            <button onClick={() => setSelected(null)} className="btn-secondary flex-1">취소</button>
            <button onClick={handleTransfer} disabled={saving} className="btn-primary flex-1">{saving ? '이동 중...' : '반 이동'}</button>
          </div>
        </div>
      ) : (
        <div className="card flex items-center justify-center text-gray-400 min-h-[200px]">
          <p>왼쪽에서 학생을 선택하세요</p>
        </div>
      )}
    </div>
  );
}

// ─── Tab: 생일조회 ────────────────────────────────────────────────────────────
function TabBirthdays() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [subTab, setSubTab] = useState('student');
  const [filterService, setFilterService] = useState('전체');
  const [filterGrade, setFilterGrade] = useState('전체');
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function load() {
    setLoading(true);
    try {
      if (subTab === 'student') {
        const svc = filterService !== '전체' ? filterService : '';
        const grade = filterGrade !== '전체' ? filterGrade.replace('학년', '') : '';
        const { students } = await api.getBirthdays(month, 'student', svc, grade);
        setStudents(students);
      } else {
        const { teachers } = await api.getBirthdays(month, 'teacher');
        setTeachers(teachers);
      }
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [month, subTab, filterService, filterGrade]);

  const posColor = { '임원': 'bg-red-100 text-red-600', '행정팀': 'bg-amber-100 text-amber-700', '교사': 'bg-sky-100 text-sky-600' };

  function copyBirthdayList() {
    const list = students.map(st => `${st.service} ${st.class_name} ${st.name}`).join('\n');
    navigator.clipboard.writeText(list)
      .then(() => showToast('복사됐습니다!', 'success'))
      .catch(() => showToast('복사 실패. 수동으로 선택하세요.', 'error'));
  }

  return (
    <div>
      <div className="card mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border-2 border-sky-200 overflow-hidden">
            {[['student', '학생'], ['teacher', '선생님']].map(([v, l]) => (
              <button key={v} onClick={() => setSubTab(v)}
                className={`px-4 py-2 font-semibold text-base transition-colors ${subTab === v ? 'bg-sky-500 text-white' : 'bg-white text-gray-500'}`}>{l}</button>
            ))}
          </div>
          <label className="font-semibold text-gray-600">월 선택</label>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="input-field max-w-[160px]">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}월</option>
            ))}
          </select>
          <span className="text-gray-400 text-base">{subTab === 'student' ? students.length : teachers.length}명</span>
          {subTab === 'student' && students.length > 0 && (
            <button onClick={copyBirthdayList} className="btn-secondary px-3 py-1.5 min-h-0 text-sm ml-auto">텍스트 복사</button>
          )}
        </div>
        {subTab === 'student' && (
          <div className="flex flex-wrap gap-2">
            {['전체', '1부', '2부'].map(s => (
              <button key={s} onClick={() => setFilterService(s)}
                className={`px-3 py-1.5 rounded-xl font-semibold text-sm border-2 transition-colors ${filterService === s ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white border-sky-200 text-gray-500'}`}>{s}</button>
            ))}
            <span className="text-gray-300 mx-1">|</span>
            {['전체', '3학년', '4학년'].map(g => (
              <button key={g} onClick={() => setFilterGrade(g)}
                className={`px-3 py-1.5 rounded-xl font-semibold text-sm border-2 transition-colors ${filterGrade === g ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white border-indigo-200 text-gray-500'}`}>{g}</button>
            ))}
          </div>
        )}
      </div>

      {loading ? <Spinner /> : subTab === 'student' ? (
        <div className="space-y-3">
          {students.map(st => (
            <div key={st.id} className="card flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-800">{st.name}</span>
                  <span className="text-sm text-gray-400">{st.gender}</span>
                  <span className={`text-sm px-2 py-0.5 rounded-full ${st.service === '1부' ? 'bg-sky-100 text-sky-600' : 'bg-blue-100 text-blue-600'}`}>{st.service}</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{st.class_name} · {st.teacher_name} 선생님</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-sky-600">
                  {st.birthday ? new Date(st.birthday).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '—'}
                </div>
                {st.phone && <div className="text-sm text-gray-400">{st.phone}</div>}
              </div>
            </div>
          ))}
          {students.length === 0 && <p className="text-center py-12 text-gray-400 text-lg">{month}월 생일인 학생이 없습니다.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {teachers.map(t => {
            const pos = t.position || (t.role === 'admin' ? '임원' : '교사');
            return (
              <div key={t.id} className="card flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-800">{t.name}</span>
                    <span className={`text-sm px-2 py-0.5 rounded-full font-semibold ${posColor[pos] || 'bg-gray-100 text-gray-500'}`}>{pos}</span>
                    {t.service && <span className={`text-sm px-2 py-0.5 rounded-full ${t.service === '1부' ? 'bg-sky-100 text-sky-600' : 'bg-blue-100 text-blue-600'}`}>{t.service}</span>}
                  </div>
                  {t.class_name && <p className="text-sm text-gray-500 mt-0.5">{t.class_name}</p>}
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-sky-600">{t.birthday || '—'}</div>
                  {t.phone && <div className="text-sm text-gray-400">{t.phone}</div>}
                </div>
              </div>
            );
          })}
          {teachers.length === 0 && <p className="text-center py-12 text-gray-400 text-lg">{month}월 생일인 선생님이 없습니다.</p>}
        </div>
      )}
    </div>
  );
}

// ─── Tab: 건의사항 ────────────────────────────────────────────────────────────
function TabSuggestions() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  async function load() {
    setLoading(true);
    try { const { suggestions } = await api.getSuggestions(); setSuggestions(suggestions); }
    catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!window.confirm('삭제하시겠습니까?')) return;
    try {
      await api.deleteSuggestion(id);
      setSuggestions(prev => prev.filter(s => s.id !== id));
      showToast('삭제됐습니다.', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-gray-700">건의(문의)사항</h3>
        <span className="text-gray-400 text-sm">{suggestions.length}건</span>
      </div>
      {suggestions.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-lg">건의사항이 없습니다.</div>
      )}
      {suggestions.map(s => (
        <div key={s.id} className="card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${s.is_anonymous ? 'bg-gray-100 text-gray-500' : 'bg-sky-100 text-sky-700'}`}>
                  {s.is_anonymous ? '익명' : s.author_name}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(s.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}{' '}
                  {new Date(s.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-gray-800 whitespace-pre-wrap break-words">{s.content}</p>
            </div>
            <button onClick={() => handleDelete(s.id)}
              className="text-red-400 font-semibold text-sm hover:text-red-600 flex-shrink-0">삭제</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: 점수기준 ────────────────────────────────────────────────────────────
const EVENT_OPTIONS = [
  { label: '말씀의 빛 챌린지', unit: '점' },
  { label: '달란트잔치', unit: '달란트' },
];

function TabRules() {
  const [rules, setRules] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    worship_pts: 10, bible_carry_pts: 5, recitation_pts: 10, bible_reading_pts: 2, evangelism_pts: 20,
    applied_from: today(), end_date: '', unit: '점', event_name: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    api.getScoreRules()
      .then(({ rules }) => {
        setRules(rules);
        setForm({ ...rules, applied_from: today(), end_date: '', unit: rules.unit || '점', event_name: rules.event_name || '' });
      })
      .catch(e => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  function handleEventChange(eventName) {
    const opt = EVENT_OPTIONS.find(e => e.label === eventName);
    setForm(f => ({ ...f, event_name: eventName, ...(opt ? { unit: opt.unit } : {}) }));
  }

  function startEdit() {
    setForm({
      ...rules,
      end_date: rules.end_date || '',
      event_name: rules.event_name || '',
      unit: rules.unit || '점',
    });
    setEditMode(true);
  }

  function cancelEdit() {
    setForm({ ...rules, applied_from: today(), end_date: '', unit: rules.unit || '점', event_name: rules.event_name || '' });
    setEditMode(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      let updated;
      if (editMode) {
        ({ rules: updated } = await api.updateScoreRules(rules.id, { ...form, end_date: form.end_date || null, event_name: form.event_name || null }));
        setEditMode(false);
      } else {
        ({ rules: updated } = await api.saveScoreRules({ ...form, end_date: form.end_date || null, event_name: form.event_name || null }));
      }
      setRules(updated);
      setForm({ ...updated, applied_from: today(), end_date: '', unit: updated.unit || '점', event_name: updated.event_name || '' });
      showToast('저장됐습니다!', 'success');
    }
    catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  if (loading) return <Spinner />;

  const fields = [
    { key: 'worship_pts', label: '예배' }, { key: 'bible_carry_pts', label: '성경지참' },
    { key: 'recitation_pts', label: '암송' }, { key: 'bible_reading_pts', label: '성경읽기 (1장당)' },
    { key: 'evangelism_pts', label: '전도' },
  ];
  const curUnit = rules?.unit || '점';

  return (
    <div className="max-w-md">
      {rules && !editMode && (
        <div className="card mb-4 bg-sky-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sky-700">현재 적용 기준</h3>
            <button onClick={startEdit} className="text-sm font-semibold text-sky-600 hover:text-sky-800 underline">수정</button>
          </div>
          {rules.event_name && (
            <span className="inline-block text-xs font-semibold bg-sky-200 text-sky-800 px-2 py-0.5 rounded-full mb-2">{rules.event_name}</span>
          )}
          <p className="text-sm text-gray-500 mb-1">
            적용일: {rules.applied_from}{rules.end_date ? ` ~ ${rules.end_date}` : ''}
          </p>
          <p className="text-sm text-gray-500 mb-2">단위: <span className="font-bold text-sky-600">{curUnit}</span></p>
          <div className="grid grid-cols-2 gap-2">
            {fields.map(f => (
              <div key={f.key} className="flex justify-between text-base">
                <span className="text-gray-600">{f.label}</span>
                <span className="font-bold text-sky-700">{rules[f.key]}{curUnit}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card">
        <h3 className="font-bold text-gray-700 mb-4">
          {editMode ? '현재 기준 수정' : '점수 기준 새로 추가'}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-gray-600 font-semibold block mb-1">행사 종류</label>
            <select value={form.event_name} onChange={e => handleEventChange(e.target.value)} className="input-field">
              <option value="">-- 선택 (선택사항) --</option>
              {EVENT_OPTIONS.map(e => <option key={e.label} value={e.label}>{e.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-600 font-semibold block mb-1">시작 날짜</label>
              <input type="date" value={form.applied_from} onChange={e => setForm(p => ({ ...p, applied_from: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="text-gray-600 font-semibold block mb-1">끝 날짜</label>
              <input type="date" value={form.end_date || ''} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-gray-600 font-semibold flex-1">단위</label>
            <div className="flex rounded-xl border-2 border-sky-200 overflow-hidden">
              {['점', '달란트'].map(u => (
                <button key={u} type="button" onClick={() => setForm(p => ({ ...p, unit: u }))}
                  className={`px-4 py-2 font-semibold text-base transition-colors ${form.unit === u ? 'bg-sky-500 text-white' : 'bg-white text-gray-500'}`}>{u}</button>
              ))}
            </div>
          </div>
          {fields.map(f => (
            <div key={f.key} className="flex items-center gap-3">
              <label className="text-gray-600 font-semibold flex-1">{f.label}</label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="100" value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: parseInt(e.target.value) || 0 }))}
                  className="w-20 text-center border-2 border-sky-200 rounded-xl py-2 text-lg font-bold focus:outline-none focus:border-sky-400" />
                <span className="text-gray-500">{form.unit}</span>
              </div>
            </div>
          ))}
        </div>
        <div className={`mt-5 ${editMode ? 'flex gap-3' : ''}`}>
          {editMode && (
            <button onClick={cancelEdit} className="btn-secondary flex-1">취소</button>
          )}
          <button onClick={handleSave} disabled={saving} className={`btn-primary ${editMode ? 'flex-1' : 'w-full'} text-lg`}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: 학생관리 ────────────────────────────────────────────────────────────
function TabStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterService, setFilterService] = useState('전체');
  const [filterType, setFilterType] = useState('전체');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', gender: '', service: '1부', grade: '3', class_name: '', teacher_name: '', type: '일반', birthday: '', phone: '', memo: '' });
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function load() {
    setLoading(true);
    try { const { students } = await api.getAllStudents(); setStudents(students); }
    catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function openEdit(st) {
    setEditing(st);
    setForm({
      name: st.name || '', gender: st.gender || '', birthday: st.birthday || '',
      phone: st.phone || '', service: st.service || '1부', grade: st.grade || '',
      class_name: st.class_name || '', teacher_name: st.teacher_name || '',
      type: st.type || '일반', is_active: st.is_active, memo: st.memo || '',
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateStudent(editing.id, { ...form, grade: form.grade ? parseInt(form.grade) : null, birthday: form.birthday || null, phone: form.phone || null, memo: form.memo || null });
      showToast(`${form.name} 정보가 저장됐습니다.`, 'success');
      setEditing(null); load();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleDeactivate(st) {
    if (!window.confirm(`${st.name} 학생을 비활성화하시겠습니까?`)) return;
    try { await api.deleteStudent(st.id); showToast(`${st.name} 비활성화됐습니다.`, 'success'); load(); }
    catch (e) { showToast(e.message, 'error'); }
  }

  async function handleAddStudent() {
    if (!addForm.name.trim()) { showToast('이름을 입력해주세요.', 'error'); return; }
    setSaving(true);
    try {
      await api.addStudent({ ...addForm, grade: addForm.grade ? parseInt(addForm.grade) : null, birthday: addForm.birthday || null, phone: addForm.phone || null, memo: addForm.memo || null, is_active: true });
      showToast(`${addForm.name} 학생이 추가됐습니다.`, 'success');
      setAdding(false); load();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  const filtered = students.filter(s => {
    const matchSearch = !search || s.name.includes(search) || s.class_name.includes(search);
    const matchService = filterService === '전체' || s.service === filterService;
    const matchType = filterType === '전체' || s.type === filterType;
    return matchSearch && matchService && matchType;
  });

  if (loading) return <Spinner />;

  const typeColor = { '일반': 'text-sky-600', '새친구': 'text-orange-500', '기도반': 'text-purple-600' };

  return (
    <div>
      <div className="card mb-4 flex flex-wrap gap-3 items-center">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="이름 또는 반 검색..." className="input-field flex-1 min-w-[180px]" />
        <div className="flex gap-2 flex-wrap">
          {['전체', '1부', '2부'].map(s => (
            <button key={s} onClick={() => setFilterService(s)}
              className={`px-3 py-2 rounded-xl font-semibold text-base border-2 transition-colors ${filterService === s ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white border-sky-200 text-gray-600'}`}>
              {s}
            </button>
          ))}
          {['전체', '일반', '새친구', '기도반'].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-2 rounded-xl font-semibold text-base border-2 transition-colors ${filterType === t ? 'bg-gray-700 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>
              {t}
            </button>
          ))}
        </div>
        <span className="text-gray-400 text-base">{filtered.length}명</span>
        <button onClick={() => setAdding(true)}
          className="ml-auto btn-primary px-4 py-2 min-h-0 text-base">+ 학생 추가</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-base min-w-[600px]">
          <thead>
            <tr className="border-b-2 border-sky-100 text-gray-500 text-sm">
              <th className="text-left py-3 px-2">이름</th><th className="text-center py-3 px-2">성별</th>
              <th className="text-left py-3 px-2">반</th><th className="text-center py-3 px-2">생일</th>
              <th className="text-left py-3 px-2">전화번호</th><th className="text-center py-3 px-2">상태</th>
              <th className="py-3 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(st => (
              <tr key={st.id} className={`border-b border-sky-50 hover:bg-sky-50/50 ${!st.is_active ? 'opacity-40' : ''}`}>
                <td className="py-2 px-2">
                  <div className="font-semibold">{st.name}</div>
                  {st.type !== '일반' && <div className={`text-xs font-semibold ${typeColor[st.type]}`}>{st.type}</div>}
                  {st.memo && <div className="text-xs text-amber-500 mt-0.5">📝 메모있음</div>}
                </td>
                <td className="py-2 px-2 text-center text-gray-500">{st.gender || '—'}</td>
                <td className="py-2 px-2 text-sm text-gray-500">{st.service} {st.class_name}</td>
                <td className="py-2 px-2 text-center text-sm">
                  {st.birthday ? new Date(st.birthday).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) : <span className="text-gray-300">미입력</span>}
                </td>
                <td className="py-2 px-2 text-sm">{st.phone || <span className="text-gray-300">미입력</span>}</td>
                <td className="py-2 px-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${st.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    {st.is_active ? '활성' : '비활성'}
                  </span>
                </td>
                <td className="py-2 px-2 text-right">
                  <button onClick={() => openEdit(st)} className="text-sky-500 font-semibold text-sm hover:text-sky-700 mr-3">편집</button>
                  {st.is_active && (
                    <button onClick={() => handleDeactivate(st)} className="text-red-400 font-semibold text-sm hover:text-red-600">비활성화</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center py-8 text-gray-400">검색 결과가 없습니다.</p>}
      </div>

      {adding && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4 overflow-y-auto">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-xl my-0 sm:my-4">
            <h3 className="text-xl font-bold mb-5">학생 추가</h3>
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 block mb-1">이름 *</label>
                  <input type="text" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="홍길동" />
                </div>
                <div>
                  <label className="text-sm text-gray-500 block mb-1">성별</label>
                  <select value={addForm.gender} onChange={e => setAddForm(f => ({ ...f, gender: e.target.value }))} className="input-field">
                    <option value="">미지정</option><option value="남">남</option><option value="여">여</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 block mb-1">예배 *</label>
                  <select value={addForm.service} onChange={e => setAddForm(f => ({ ...f, service: e.target.value }))} className="input-field">
                    <option value="1부">1부</option><option value="2부">2부</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-500 block mb-1">학년 *</label>
                  <select value={addForm.grade} onChange={e => setAddForm(f => ({ ...f, grade: e.target.value }))} className="input-field">
                    <option value="3">3학년</option><option value="4">4학년</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">반 *</label>
                <input type="text" value={addForm.class_name} onChange={e => setAddForm(f => ({ ...f, class_name: e.target.value }))} className="input-field" placeholder="예: 3학년 1반" />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">담당 선생님</label>
                <input type="text" value={addForm.teacher_name} onChange={e => setAddForm(f => ({ ...f, teacher_name: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">유형</label>
                <select value={addForm.type} onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))} className="input-field">
                  <option value="일반">일반</option><option value="새친구">새친구</option><option value="기도반">기도반</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 block mb-1">생일</label>
                  <input type="date" value={addForm.birthday} onChange={e => setAddForm(f => ({ ...f, birthday: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="text-sm text-gray-500 block mb-1">전화번호</label>
                  <input type="tel" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000" className="input-field" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setAdding(false)} className="btn-secondary flex-1">취소</button>
              <button onClick={handleAddStudent} disabled={saving} className="btn-primary flex-1">{saving ? '추가 중...' : '추가'}</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4 overflow-y-auto">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-xl my-0 sm:my-4">
            <h3 className="text-xl font-bold mb-5">{editing.name} 정보 편집</h3>
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 block mb-1">이름</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="text-sm text-gray-500 block mb-1">성별</label>
                  <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className="input-field">
                    <option value="">미지정</option><option value="남">남</option><option value="여">여</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 block mb-1">생일</label>
                  <input type="date" value={form.birthday} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="text-sm text-gray-500 block mb-1">전화번호</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000" className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 block mb-1">예배</label>
                  <select value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} className="input-field">
                    <option value="1부">1부</option><option value="2부">2부</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-500 block mb-1">학년</label>
                  <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} className="input-field">
                    <option value="">미지정</option><option value="3">3학년</option><option value="4">4학년</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">반</label>
                <input type="text" value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">담당 선생님</label>
                <input type="text" value={form.teacher_name} onChange={e => setForm(f => ({ ...f, teacher_name: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">유형</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input-field">
                  <option value="일반">일반</option><option value="새친구">새친구</option><option value="기도반">기도반</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">메모</label>
                <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                  placeholder="메모 (선택사항)" rows={2}
                  className="w-full border-2 border-sky-200 rounded-xl px-3 py-2 text-base focus:outline-none focus:border-sky-400 resize-none" />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <label className="font-semibold text-gray-600">활성 상태</label>
                <button type="button" onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${form.is_active ? 'bg-sky-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditing(null)} className="btn-secondary flex-1">취소</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: 선생님관리 ──────────────────────────────────────────────────────────
function TabTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterService, setFilterService] = useState('전체');
  const [filterPosition, setFilterPosition] = useState('전체');
  const [pinModal, setPinModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [addingTeacher, setAddingTeacher] = useState(false);
  const [addTeacherForm, setAddTeacherForm] = useState({ name: '', pin: '', position: '교사', service: '', class_name: '', phone: '', birthday: '' });
  const [pinValue, setPinValue] = useState('');
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function load() {
    setLoading(true);
    try { const { teachers } = await api.getTeachers(); setTeachers(teachers); }
    catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function handleChangePin() {
    if (!pinValue || pinValue.length < 4) { showToast('PIN은 4자리 이상이어야 합니다.', 'error'); return; }
    setSaving(true);
    try {
      await api.changePin(pinModal.id, pinValue);
      showToast(`${pinModal.name} PIN이 변경됐습니다.`, 'success');
      setPinModal(null); setPinValue('');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleResetAllPins() {
    if (!window.confirm('모든 선생님 PIN을 0000으로 초기화하시겠습니까?')) return;
    try {
      await api.resetAllPins();
      showToast('모든 PIN이 0000으로 초기화됐습니다.', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  }

  function openEdit(t) {
    setEditModal(t);
    setEditForm({ phone: t.phone || '', birthday: t.birthday || '', class_name: t.class_name || '', service: t.service || '', name: t.name || '', position: t.position || '교사' });
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await api.updateTeacher(editModal.id, editForm);
      showToast('저장됐습니다.', 'success');
      setEditModal(null); load();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleAddTeacher() {
    if (!addTeacherForm.name.trim()) { showToast('이름을 입력해주세요.', 'error'); return; }
    if (addTeacherForm.pin.length < 4) { showToast('PIN은 4자리 이상이어야 합니다.', 'error'); return; }
    setSaving(true);
    try {
      await api.addTeacher(addTeacherForm);
      showToast(`${addTeacherForm.name} 선생님이 추가됐습니다.`, 'success');
      setAddingTeacher(false);
      setAddTeacherForm({ name: '', pin: '', position: '교사', service: '', class_name: '', phone: '', birthday: '' });
      load();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleDeleteTeacher(t) {
    if (!window.confirm(`${t.name} 선생님을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    try { await api.deleteTeacher(t.id); showToast(`${t.name} 선생님이 삭제됐습니다.`, 'success'); load(); }
    catch (e) { showToast(e.message, 'error'); }
  }

  function getPositions(t) {
    const primary = t.position || (t.role === 'admin' ? '임원' : '교사');
    if ((primary === '임원' || primary === '행정팀') && t.class_name) {
      return [primary, '교사'];
    }
    return [primary];
  }

  const filtered = teachers.filter(t => {
    const matchSearch = !search || t.name.includes(search) || (t.class_name || '').includes(search);
    const matchService = filterService === '전체' || t.service === filterService;
    const matchPosition = filterPosition === '전체' || getPositions(t).includes(filterPosition);
    return matchSearch && matchService && matchPosition;
  });

  const posColor = { '임원': 'bg-red-100 text-red-600', '행정팀': 'bg-amber-100 text-amber-700', '교사': 'bg-sky-100 text-sky-600' };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="card mb-4 space-y-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="이름 또는 반 검색..." className="input-field" />
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-500 font-semibold">역할</span>
          {['전체', '임원', '행정팀', '교사'].map(p => (
            <button key={p} onClick={() => setFilterPosition(p)}
              className={`px-3 py-1.5 rounded-xl font-semibold text-sm border-2 transition-colors ${filterPosition === p ? 'bg-gray-700 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>
              {p}
            </button>
          ))}
          <span className="text-gray-300 mx-1">|</span>
          <span className="text-sm text-gray-500 font-semibold">예배</span>
          {['전체', '1부', '2부'].map(s => (
            <button key={s} onClick={() => setFilterService(s)}
              className={`px-3 py-1.5 rounded-xl font-semibold text-sm border-2 transition-colors ${filterService === s ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white border-sky-200 text-gray-600'}`}>
              {s}
            </button>
          ))}
          <span className="text-gray-400 ml-2">{filtered.length}명</span>
          <div className="ml-auto flex gap-3 items-center">
            <button onClick={() => setAddingTeacher(true)} className="text-sm text-sky-600 hover:text-sky-800 font-semibold underline">+ 선생님 추가</button>
            <button onClick={handleResetAllPins} className="text-sm text-red-500 hover:text-red-700 font-semibold underline">전체 PIN 초기화</button>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b-2 border-sky-100 text-gray-500">
              <th className="text-left py-3 px-2">이름</th>
              <th className="text-center py-3 px-2">예배/반</th>
              <th className="text-left py-3 px-2">전화번호</th>
              <th className="text-center py-3 px-2">생일</th>
              <th className="text-center py-3 px-2">역할</th>
              <th className="py-3 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} className="border-b border-sky-50 hover:bg-sky-50/50">
                <td className="py-2 px-2 font-semibold text-gray-800">{t.name}</td>
                <td className="py-2 px-2 text-center text-gray-500 text-xs">
                  {t.service && <span className={`inline-block px-1.5 py-0.5 rounded mr-1 ${t.service === '1부' ? 'bg-sky-100 text-sky-600' : 'bg-blue-100 text-blue-600'}`}>{t.service}</span>}
                  {t.class_name || '—'}
                </td>
                <td className="py-2 px-2 text-gray-600">{t.phone || <span className="text-gray-300">미등록</span>}</td>
                <td className="py-2 px-2 text-center text-gray-500">{t.birthday || <span className="text-gray-300">미등록</span>}</td>
                <td className="py-2 px-2 text-center">
                  {getPositions(t).map(pos => (
                    <span key={pos} className={`text-xs px-2 py-0.5 rounded-full font-semibold mr-1 ${posColor[pos] || 'bg-gray-100 text-gray-500'}`}>{pos}</span>
                  ))}
                </td>
                <td className="py-2 px-2 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(t)} className="text-sky-500 font-semibold text-sm hover:text-sky-700 mr-3">정보편집</button>
                  <button onClick={() => { setPinModal(t); setPinValue(''); }} className="text-orange-500 font-semibold text-sm hover:text-orange-700 mr-3">PIN변경</button>
                  <button onClick={() => handleDeleteTeacher(t)} className="text-red-400 font-semibold text-sm hover:text-red-600">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center py-8 text-gray-400">검색 결과가 없습니다.</p>}
      </div>

      {/* 선생님 추가 모달 */}
      {addingTeacher && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4 overflow-y-auto">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-xl my-0 sm:my-4">
            <h3 className="text-xl font-bold mb-5">선생님 추가</h3>
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 block mb-1">이름 *</label>
                  <input type="text" value={addTeacherForm.name} onChange={e => setAddTeacherForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="홍길동" />
                </div>
                <div>
                  <label className="text-sm text-gray-500 block mb-1">PIN * (4자리)</label>
                  <input type="text" inputMode="numeric" maxLength={8} value={addTeacherForm.pin}
                    onChange={e => setAddTeacherForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
                    className="input-field text-center tracking-widest font-bold" placeholder="0000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 block mb-1">역할</label>
                  <select value={addTeacherForm.position} onChange={e => setAddTeacherForm(f => ({ ...f, position: e.target.value }))} className="input-field">
                    <option value="교사">교사</option>
                    <option value="행정팀">행정팀</option>
                    <option value="임원">임원</option>
                    <option value="관리자">관리자</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-500 block mb-1">예배</label>
                  <select value={addTeacherForm.service} onChange={e => setAddTeacherForm(f => ({ ...f, service: e.target.value }))} className="input-field">
                    <option value="">—</option>
                    <option value="1부">1부</option>
                    <option value="2부">2부</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">담당반</label>
                <input type="text" value={addTeacherForm.class_name} onChange={e => setAddTeacherForm(f => ({ ...f, class_name: e.target.value }))} className="input-field" placeholder="예: 3학년 1반" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 block mb-1">전화번호</label>
                  <input type="tel" value={addTeacherForm.phone} onChange={e => setAddTeacherForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000" className="input-field" />
                </div>
                <div>
                  <label className="text-sm text-gray-500 block mb-1">생일</label>
                  <input type="text" value={addTeacherForm.birthday} onChange={e => setAddTeacherForm(f => ({ ...f, birthday: e.target.value }))} placeholder="예: 3월14일" className="input-field" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setAddingTeacher(false)} className="btn-secondary flex-1">취소</button>
              <button onClick={handleAddTeacher} disabled={saving} className="btn-primary flex-1">{saving ? '추가 중...' : '추가'}</button>
            </div>
          </div>
        </div>
      )}

      {/* PIN 변경 모달 */}
      {pinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl">
            <h3 className="text-xl font-bold mb-1">{pinModal.name}</h3>
            <p className="text-sm text-gray-400 mb-4">새 PIN 번호를 입력하세요</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={pinValue}
              onChange={e => setPinValue(e.target.value.replace(/\D/g, ''))}
              placeholder="새 PIN (4자리 이상)"
              className="input-field text-center text-2xl tracking-widest font-bold mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setPinModal(null)} className="btn-secondary flex-1">취소</button>
              <button onClick={handleChangePin} disabled={saving} className="btn-primary flex-1">{saving ? '변경 중...' : '변경'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 정보 편집 모달 */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-xl font-bold mb-4">{editModal.name} 정보 편집</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500 block mb-1">이름</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-500 block mb-1">역할</label>
                  <select value={editForm.position} onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))} className="input-field">
                    <option value="관리자">관리자</option>
                    <option value="임원">임원</option>
                    <option value="행정팀">행정팀</option>
                    <option value="교사">교사</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-500 block mb-1">예배</label>
                  <select value={editForm.service} onChange={e => setEditForm(f => ({ ...f, service: e.target.value }))} className="input-field">
                    <option value="">—</option>
                    <option value="1부">1부</option><option value="2부">2부</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">담당반</label>
                <input type="text" value={editForm.class_name} onChange={e => setEditForm(f => ({ ...f, class_name: e.target.value }))} placeholder="예: 3-1반" className="input-field" />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">전화번호</label>
                <input type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000" className="input-field" />
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-1">생일</label>
                <input type="text" value={editForm.birthday} onChange={e => setEditForm(f => ({ ...f, birthday: e.target.value }))} placeholder="예: 3월14일" className="input-field" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditModal(null)} className="btn-secondary flex-1">취소</button>
              <button onClick={handleSaveEdit} disabled={saving} className="btn-primary flex-1">{saving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Admin ───────────────────────────────────────────────────────────────
export default function Admin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const position = user?.position;
  const visibleTabs = getVisibleTabs(position);
  const [activeTab, setActiveTab] = useState(visibleTabs[0]);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) setActiveTab(visibleTabs[0]);
  }, [position]);

  function handleLogout() { logout(); navigate('/login'); }

  const safeTab = visibleTabs.includes(activeTab) ? activeTab : visibleTabs[0];

  return (
    <div className="min-h-screen bg-sky-50">
      <header className="bg-sky-500 text-white px-4 py-3 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-bold">{position || '관리자'} 대시보드</h1>
            <p className="text-sky-100 text-sm">{user?.name}</p>
          </div>
          <div className="flex gap-3 items-center shrink-0">
            <button onClick={() => navigate('/attendance')} className="text-sky-100 text-sm underline">출석체크</button>
            <button onClick={() => navigate('/teacher')} className="text-sky-100 text-sm underline">점수입력</button>
            <button onClick={handleLogout} className="text-sky-100 text-sm underline">로그아웃</button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-sky-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto overflow-x-auto">
          <div className="flex min-w-max">
            {visibleTabs.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-4 font-semibold text-base whitespace-nowrap border-b-2 transition-colors ${
                  safeTab === tab ? 'text-sky-600 border-sky-500' : 'text-gray-500 border-transparent hover:text-sky-500'
                }`}>
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-3 py-5">
        {safeTab === '주간출석' && <TabAttendance />}
        {safeTab === '출석체크' && <TabAdminAttendance />}
        {safeTab === '점수현황' && <TabScores />}
        {safeTab === '새친구관리' && <TabNewFriends />}
        {safeTab === '반이동' && <TabTransfer />}
        {safeTab === '생일조회' && <TabBirthdays />}
        {safeTab === '점수기준' && <TabRules />}
        {safeTab === '학생관리' && <TabStudents />}
        {safeTab === '선생님관리' && <TabTeachers />}
        {safeTab === '건의사항' && <TabSuggestions />}
      </main>
    </div>
  );
}
