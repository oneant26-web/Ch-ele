import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';

const GROUPS = ['1부', '2부', '행정팀', '임원단'];

// 이중 역할 지원: 임원이면서 반 담당이면 두 그룹 모두에 표시
function getUserGroups(u) {
  const groups = [];
  if (u.position === '행정팀') {
    groups.push('행정팀');
    return groups;
  }
  if (u.role === 'admin' || u.position === '임원' || u.position === '관리자') {
    groups.push('임원단');
  }
  if (u.service === '1부' || u.service === '2부') {
    groups.push(u.service);
  }
  return groups;
}

function classNameToSortKey(n) {
  const nums = (n.match(/\d+/g) || []).map(Number);
  if (nums.length === 0) return 0;
  if (nums.length === 1) return nums[0];
  return nums[0] * 1000 + nums[nums.length - 1];
}

export default function Login() {
  const [users, setUsers] = useState([]);
  const [group, setGroup] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const { login, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate((user.role === 'admin' || user.position === '행정팀') ? '/admin' : '/teacher', { replace: true });
    }
  }, [user]);

  useEffect(() => {
    api.getUsers()
      .then(({ users }) => setUsers(users))
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    if (!name || pin.length !== 4) {
      showToast('이름과 4자리 PIN을 입력해주세요.', 'error');
      return;
    }
    setLoading(true);
    const login_as = (group === '임원단' || group === '행정팀') ? 'admin' : 'teacher';
    try {
      const loggedUser = await login(name, pin, login_as);
      showToast(`${loggedUser.name} 선생님, 환영합니다!`, 'success');
      navigate(login_as === 'admin' ? '/admin' : '/teacher', { replace: true });
    } catch (e) {
      showToast(e.message, 'error');
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  function handlePinDigit(digit) {
    if (pin.length < 4) setPin(p => p + digit);
  }

  function handlePinBack() {
    setPin(p => p.slice(0, -1));
  }

  const groupedUsers = {};
  users.forEach(u => {
    getUserGroups(u).forEach(g => {
      if (!groupedUsers[g]) groupedUsers[g] = [];
      if (!groupedUsers[g].some(x => x.id === u.id)) groupedUsers[g].push(u);
    });
  });
  const filteredUsers = (groupedUsers[group] || []).slice().sort((a, b) => {
    if (group === '1부' || group === '2부') {
      const d = classNameToSortKey(a.class_name || '') - classNameToSortKey(b.class_name || '');
      return d !== 0 ? d : a.name.localeCompare(b.name, 'ko');
    }
    return a.name.localeCompare(b.name, 'ko');
  });

  if (loadingUsers) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col">
      {/* Header */}
      <header className="bg-sky-500 text-white px-4 py-5 shadow-md">
        <div className="max-w-sm mx-auto flex items-center gap-3">
          <Link to="/attendance" className="text-sky-100 text-2xl">←</Link>
          <h1 className="text-xl font-bold">선생님 로그인</h1>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 pt-8">
        <div className="card w-full max-w-sm">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Group selector */}
            <div>
              <label className="block text-gray-600 font-semibold mb-2">그룹 선택</label>
              <div className="grid grid-cols-4 gap-2">
                {GROUPS.map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => { setGroup(g); setName(''); }}
                    className={`min-h-[48px] rounded-xl font-semibold text-base border-2 transition-colors ${
                      group === g ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white border-sky-200 text-gray-600'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Name selector */}
            {group && (
              <div>
                <label className="block text-gray-600 font-semibold mb-2">이름 선택</label>
                <select
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">-- 이름을 선택하세요 --</option>
                  {filteredUsers.map(u => (
                    <option key={u.id} value={u.name}>
                      {(group === '1부' || group === '2부') && u.class_name
                        ? `${u.class_name} ${u.name}`
                        : u.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* PIN display */}
            <div>
              <label className="block text-gray-600 font-semibold mb-2">PIN 번호 (4자리)</label>
              <div className="flex gap-3 justify-center mb-4">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-colors ${
                      i < pin.length
                        ? 'bg-sky-500 border-sky-500 text-white'
                        : 'bg-white border-sky-200 text-transparent'
                    }`}
                  >
                    {i < pin.length ? '●' : '○'}
                  </div>
                ))}
              </div>

              {/* Number pad */}
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handlePinDigit(String(n))}
                    className="min-h-[52px] bg-white border-2 border-sky-200 rounded-xl text-xl font-bold text-gray-700 hover:bg-sky-50 active:bg-sky-100 transition-colors"
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPin('')}
                  className="min-h-[52px] bg-white border-2 border-sky-200 rounded-xl text-base font-bold text-gray-500 hover:bg-sky-50 transition-colors"
                >
                  지우기
                </button>
                <button
                  type="button"
                  onClick={() => handlePinDigit('0')}
                  className="min-h-[52px] bg-white border-2 border-sky-200 rounded-xl text-xl font-bold text-gray-700 hover:bg-sky-50 active:bg-sky-100 transition-colors"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handlePinBack}
                  className="min-h-[52px] bg-white border-2 border-sky-200 rounded-xl text-xl font-semibold text-gray-500 hover:bg-sky-50 transition-colors"
                >
                  ←
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !name || pin.length !== 4}
              className="btn-primary w-full text-xl"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
