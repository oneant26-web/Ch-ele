require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const { error } = await supabase
    .from('users')
    .update({ pin: '0000' })
    .in('role', ['admin', 'teacher', 'checker']);
  if (error) { console.error('오류:', error.message); return; }
  console.log('✅ 모든 사용자 PIN이 0000으로 초기화됐습니다!');
}
main().catch(console.error);
