require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const PRAYER_STUDENTS = [
  // 1부 기도반 (grade=4, born 2016)
  { name: '배시은', gender: '여', birthday: null,         service: '1부', grade: 4 },
  { name: '임서희', gender: '여', birthday: '2016-11-17', service: '1부', grade: 4 },
  { name: '박세은', gender: '여', birthday: '2016-11-24', service: '1부', grade: 4 },
  { name: '문채원', gender: '여', birthday: '2016-11-29', service: '1부', grade: 4 },
  { name: '손유나', gender: '여', birthday: '2016-11-26', service: '1부', grade: 4 },
  { name: '백준우', gender: '남', birthday: '2016-02-10', service: '1부', grade: 4 },
  // 2부 기도반 (grade=4, born 2016)
  { name: '성수현', gender: '남', birthday: '2016-05-01', service: '2부', grade: 4 },
  { name: '장동윤', gender: '남', birthday: '2016-10-08', service: '2부', grade: 4 },
  { name: '노지율', gender: '남', birthday: '2016-04-21', service: '2부', grade: 4 },
  { name: '톰슨태오', gender: '남', birthday: '2016-07-20', service: '2부', grade: 4 },
  { name: '장택한', gender: '남', birthday: '2016-06-19', service: '2부', grade: 4 },
  { name: '심하빈', gender: '남', birthday: '2016-12-23', service: '2부', grade: 4 },
  { name: '우다인', gender: '여', birthday: '2016-07-22', service: '2부', grade: 4 },
  { name: '유은성', gender: '남', birthday: '2016-06-13', service: '2부', grade: 4 },
  { name: '민하율', gender: '남', birthday: '2016-04-06', service: '2부', grade: 4 },
  { name: '김하연', gender: '여', birthday: '2016-05-18', service: '2부', grade: 4 },
  { name: '김수인', gender: '여', birthday: '2016-04-11', service: '2부', grade: 4 },
  { name: '현지온', gender: '여', birthday: '2016-12-05', service: '2부', grade: 4 },
  { name: '권지아', gender: '여', birthday: '2016-12-04', service: '2부', grade: 4 },
  { name: '진세연', gender: '여', birthday: '2016-03-07', service: '2부', grade: 4 },
];

async function main() {
  let added = 0, updated = 0, skipped = 0;

  for (const s of PRAYER_STUDENTS) {
    const { data: existing } = await supabase
      .from('students')
      .select('id, type')
      .eq('name', s.name)
      .eq('service', s.service)
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      if (existing.type === '기도반') {
        console.log(`⏭  이미 기도반: ${s.name} (${s.service})`);
        skipped++;
      } else {
        await supabase.from('students').update({ type: '기도반', class_name: '기도반', teacher_name: '' }).eq('id', existing.id);
        console.log(`✏️  기도반으로 변경: ${s.name} (${s.service}) [기존 type: ${existing.type}]`);
        updated++;
      }
    } else {
      const { error } = await supabase.from('students').insert({
        name: s.name,
        gender: s.gender,
        birthday: s.birthday || null,
        service: s.service,
        grade: s.grade,
        class_name: '기도반',
        teacher_name: '',
        type: '기도반',
        new_friend_count: 0,
        is_active: true,
      });
      if (error) console.error(`❌  삽입 오류 ${s.name}:`, error.message);
      else { console.log(`✅  추가: ${s.name} (${s.service})`); added++; }
    }
  }

  console.log(`\n완료: 추가 ${added}명, 기도반변경 ${updated}명, 이미처리 ${skipped}명`);
}

main().catch(console.error);
