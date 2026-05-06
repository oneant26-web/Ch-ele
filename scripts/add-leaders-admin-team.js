require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// 임원단 — role='admin', position='임원'
const LEADERS = [
  { name: '조성효', phone: '010-9379-5848', birthday: '12월 29일', position: '임원', role: 'admin', title: '목사님' },
  { name: '김신혁', phone: '010-4018-0853', birthday: '4월 24일',  position: '임원', role: 'admin', title: '부장' },
  { name: '한상겸', phone: '010-9341-9233', birthday: '12월 28일', position: '임원', role: 'admin', title: '부감' },
  { name: '표명희', phone: '010-4903-1770', birthday: '10월 30일', position: '임원', role: 'admin', title: '총무' },
  { name: '배은희', phone: '010-4245-9828', birthday: '9월 27일',  position: '임원', role: null,    title: '회계' },   // 교사 계정 유지, position만 변경
  { name: '홍은주', phone: '010-8362-2120', birthday: '8월 6일',   position: '임원', role: 'admin', title: '1부 3학년팀장' },
  { name: '남문희', phone: '010-2858-0853', birthday: '7월 17일',  position: '임원', role: 'admin', title: '1부 4학년팀장' },
  { name: '김성실', phone: '010-5375-9298', birthday: '8월 25일',  position: '임원', role: 'admin', title: '2부 3학년팀장' },
  { name: '배은미', phone: '010-4929-9149', birthday: '1월 7일',   position: '임원', role: 'admin', title: '2부 4학년팀장' },
  { name: '여복환', phone: '010-5024-9322', birthday: '9월 14일',  position: '임원', role: 'admin', title: '2부 새친구반' },
  { name: '구예진', phone: '010-2325-2406', birthday: '2월 3일',   position: '임원', role: 'admin', title: '대외협력팀장' },
  { name: '이예령', phone: '010-4333-1495', birthday: '3월 19일',  position: '임원', role: 'admin', title: '행정팀장' },
];

// 행정팀 — role='teacher', position='행정팀'
// 이예령은 임원단에서 처리, 박한주는 기존 교사 계정 업데이트
const ADMIN_TEAM = [
  { name: '권다혜', phone: '010-4435-9197', birthday: '1월 23일',  position: '행정팀', role: 'teacher' },
  { name: '금가현', phone: '010-6253-1364', birthday: '10월 26일', position: '행정팀', role: 'teacher' },
  { name: '김민지', phone: '010-7602-8550', birthday: '4월 23일',  position: '행정팀', role: 'teacher' },
  { name: '김수진', phone: '010-3232-0245', birthday: '1월 18일',  position: '행정팀', role: 'teacher' },
  { name: '김예선', phone: '010-7171-7305', birthday: '11월 18일', position: '행정팀', role: 'teacher' },
  { name: '이서범', phone: '010-7544-2928', birthday: '11월 2일',  position: '행정팀', role: 'teacher' },
  { name: '정요셉', phone: '010-4359-0054', birthday: '11월 5일',  position: '행정팀', role: 'teacher' },
  { name: '조시현', phone: '010-2549-8731', birthday: '1월 11일',  position: '행정팀', role: 'teacher' },
  { name: '최아연', phone: '010-6874-9099', birthday: '10월 13일', position: '행정팀', role: 'teacher' },
  { name: '박한주', phone: '010-5107-2792', birthday: null,         position: '행정팀', role: null },   // 기존 교사 계정, position만 변경
  { name: '신은진', phone: '010-9247-1930', birthday: null,         position: '행정팀', role: 'teacher' },
  { name: '신찬희', phone: '010-7671-9828', birthday: '11월 9일',  position: '행정팀', role: 'teacher' },
];

async function upsertMember(m) {
  const { data: existing } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('name', m.name)
    .maybeSingle();

  if (existing) {
    const update = { phone: m.phone, position: m.position };
    if (m.birthday) update.birthday = m.birthday;
    if (m.role) update.role = m.role;   // only update role if specified
    const { error } = await supabase.from('users').update(update).eq('id', existing.id);
    if (error) console.error(`❌  업데이트 오류 ${m.name}:`, error.message);
    else console.log(`✏️  업데이트: ${m.name} (position=${m.position})`);
  } else {
    const insert = {
      name: m.name,
      phone: m.phone,
      birthday: m.birthday || null,
      position: m.position,
      role: m.role || 'teacher',
      pin: '0000',
      class_name: null,
      service: null,
    };
    const { error } = await supabase.from('users').insert(insert);
    if (error) console.error(`❌  삽입 오류 ${m.name}:`, error.message);
    else console.log(`✅  추가: ${m.name} (${m.position}, PIN=0000)`);
  }
}

async function main() {
  console.log('=== 임원단 처리 ===');
  for (const m of LEADERS) await upsertMember(m);

  console.log('\n=== 행정팀 처리 ===');
  for (const m of ADMIN_TEAM) await upsertMember(m);

  console.log('\n완료!');
}

main().catch(console.error);
