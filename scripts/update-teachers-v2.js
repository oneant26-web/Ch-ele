// 선생님 데이터 업데이트 스크립트 (미정 → 실명, 전화번호/생일 추가)
// 실행 전: supabase/migrate-v2.sql 먼저 Supabase SQL Editor에서 실행할 것
// 실행: node scripts/update-teachers-v2.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 새로 추가할 선생님 (기존에 "미정"이었던 반)
const NEW_TEACHERS = [
  { name: '박은영', role: 'teacher', class_name: '4-5반', service: '1부', pin: '0000', phone: '010-2284-2214', birthday: '3월14일' },
  { name: '이효성', role: 'teacher', class_name: '4-6반', service: '1부', pin: '0000', phone: '010-4019-0853', birthday: '7월28일' },
  { name: '배은희', role: 'teacher', class_name: '4-7반', service: '1부', pin: '0000', phone: '010-4245-9828', birthday: '9월27일' },
  { name: '김수경', role: 'teacher', class_name: '3-5반', service: '2부', pin: '0000', phone: '010-8985-8459', birthday: '5월29일' },
  { name: '권선미', role: 'teacher', class_name: '3-6반', service: '2부', pin: '0000', phone: '010-7746-1371', birthday: '2월24일' },
  { name: '박윤정', role: 'teacher', class_name: '3-7반', service: '2부', pin: '0000', phone: '010-5090-3175', birthday: null },
  { name: '남윤종', role: 'teacher', class_name: '3-8반', service: '2부', pin: '0000', phone: '010-7377-4333', birthday: '7월28일' },
  { name: '조수진', role: 'teacher', class_name: '3-9반', service: '2부', pin: '0000', phone: '010-9317-5014', birthday: '3월19일' },
  { name: '조수현', role: 'teacher', class_name: '3-10반', service: '2부', pin: '0000', phone: null, birthday: null },
  { name: '이진희', role: 'teacher', class_name: '3-11반', service: '2부', pin: '0000', phone: '010-4272-2724', birthday: '11월4일' },
  { name: '유소리', role: 'teacher', class_name: '4-5반', service: '2부', pin: '0000', phone: '010-5445-2717', birthday: '5월17일' },
  { name: '남선태', role: 'teacher', class_name: '4-6반', service: '2부', pin: '0000', phone: '010-6690-7344', birthday: '12월25일' },
  { name: '김성은', role: 'teacher', class_name: '4-7반', service: '2부', pin: '0000', phone: '010-9558-1757', birthday: null },
  { name: '홍경희', role: 'teacher', class_name: '4-8반', service: '2부', pin: '0000', phone: '010-6622-2561', birthday: '7월13일' },
  { name: '손화숙', role: 'teacher', class_name: '4-9반', service: '2부', pin: '0000', phone: '010-4521-8776', birthday: '4월27일' },
  { name: '정종미', role: 'teacher', class_name: '4-10반', service: '2부', pin: '0000', phone: '010-7678-7795', birthday: '10월1일' },
  { name: '박미은', role: 'teacher', class_name: '4-11반', service: '2부', pin: '0000', phone: '010-2079-9898', birthday: '5월15일' },
  { name: '박소희', role: 'teacher', class_name: '4-12반', service: '2부', pin: '0000', phone: null, birthday: null },
];

// 기존 선생님 전화번호/생일 업데이트
const UPDATE_TEACHERS = [
  { name: '문소희',  phone: '010-2985-7421', birthday: '2월23일' },
  { name: '이상호',  phone: '010-8158-5770', birthday: '2월28일' },
  { name: '임순주',  phone: '010-8331-4327', birthday: '3월29일' },
  { name: '김근영',  phone: '010-2807-6423', birthday: '2월27일' },
  { name: '김지현',  phone: '010-4238-3957', birthday: '10월23일' },
  { name: '김신애',  phone: '010-4262-1224', birthday: '8월23일' },
  { name: '서진선',  phone: '010-9912-1643', birthday: '12월21일' },
  { name: '류희영',  phone: '010-6700-8586', birthday: '4월1일' },
  { name: '김수정',  phone: '010-8581-3676', birthday: '11월11일' },
  { name: '권경준',  phone: '010-5206-2806', birthday: null },
  { name: '정의헌',  phone: '010-6543-4681', birthday: '9월19일' },
  { name: '박한주',  phone: '010-5107-2792', birthday: null },
  { name: '곽혜리',  phone: '010-8470-2197', birthday: '12월20일' },
  { name: '김민아',  phone: '010-6567-1372', birthday: null },
  { name: '임예린',  phone: '010-2991-4030', birthday: '6월7일' },
  { name: '김찬송',  phone: '010-5520-9927', birthday: '4월11일' },
  { name: '신승훈',  phone: '010-2671-8764', birthday: '5월9일' },
  { name: '임재한',  phone: '010-9363-3872', birthday: '8월23일' },
  { name: '김동언',  phone: '010-7375-0206', birthday: null },
  { name: '박정은',  phone: '010-5077-4226', birthday: '3월18일' },
];

// 학생 담임 정보 (미정 → 실명)
const CLASS_TEACHER_UPDATES = [
  { service: '1부', class_name: '4-5반',  teacher_name: '박은영' },
  { service: '1부', class_name: '4-6반',  teacher_name: '이효성' },
  { service: '1부', class_name: '4-7반',  teacher_name: '배은희' },
  { service: '2부', class_name: '3-5반',  teacher_name: '김수경' },
  { service: '2부', class_name: '3-6반',  teacher_name: '권선미' },
  { service: '2부', class_name: '3-7반',  teacher_name: '박윤정' },
  { service: '2부', class_name: '3-8반',  teacher_name: '남윤종' },
  { service: '2부', class_name: '3-9반',  teacher_name: '조수진' },
  { service: '2부', class_name: '3-10반', teacher_name: '조수현' },
  { service: '2부', class_name: '3-11반', teacher_name: '이진희' },
  { service: '2부', class_name: '4-5반',  teacher_name: '유소리' },
  { service: '2부', class_name: '4-6반',  teacher_name: '남선태' },
  { service: '2부', class_name: '4-7반',  teacher_name: '김성은' },
  { service: '2부', class_name: '4-8반',  teacher_name: '홍경희' },
  { service: '2부', class_name: '4-9반',  teacher_name: '손화숙' },
  { service: '2부', class_name: '4-10반', teacher_name: '정종미' },
  { service: '2부', class_name: '4-11반', teacher_name: '박미은' },
  { service: '2부', class_name: '4-12반', teacher_name: '박소희' },
];

async function main() {
  console.log('🚀 선생님 데이터 업데이트 시작...\n');

  // 1. 학생 담임 이름 업데이트 (미정 → 실명)
  console.log('1️⃣  학생 담임 정보 업데이트 (미정 → 실명)...');
  for (const upd of CLASS_TEACHER_UPDATES) {
    const { error } = await supabase.from('students')
      .update({ teacher_name: upd.teacher_name })
      .eq('service', upd.service)
      .eq('class_name', upd.class_name)
      .eq('teacher_name', '미정');
    if (error) console.error(`   ❌ ${upd.service} ${upd.class_name}:`, error.message);
    else console.log(`   ✅ ${upd.service} ${upd.class_name} → ${upd.teacher_name}`);
  }
  console.log('');

  // 2. 새 선생님 계정 추가
  console.log('2️⃣  새 선생님 계정 추가 중...');
  for (const t of NEW_TEACHERS) {
    const { data: exists } = await supabase.from('users')
      .select('id').eq('name', t.name).eq('service', t.service).maybeSingle();
    if (exists) {
      await supabase.from('users').update({ phone: t.phone, birthday: t.birthday, class_name: t.class_name }).eq('id', exists.id);
      console.log(`   ⏭  ${t.name} (이미 존재, 정보 업데이트)`);
    } else {
      const { error } = await supabase.from('users').insert(t);
      if (error) console.error(`   ❌ ${t.name}:`, error.message);
      else console.log(`   ✅ ${t.name} (${t.service} ${t.class_name})`);
    }
  }
  console.log('');

  // 3. 기존 선생님 전화번호/생일 업데이트
  console.log('3️⃣  기존 선생님 연락처/생일 업데이트 중...');
  for (const t of UPDATE_TEACHERS) {
    const update = {};
    if (t.phone) update.phone = t.phone;
    if (t.birthday) update.birthday = t.birthday;
    const { error } = await supabase.from('users').update(update).eq('name', t.name);
    if (error) console.error(`   ❌ ${t.name}:`, error.message);
    else console.log(`   ✅ ${t.name}`);
  }
  console.log('');

  const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'teacher');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 완료! 선생님 계정 총 ${count}명`);
  console.log('새로 추가된 선생님 기본 PIN: 0000');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(e => { console.error(e); process.exit(1); });
