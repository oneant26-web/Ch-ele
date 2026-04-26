// ============================================================
// 시트 초기 설정 스크립트
// Apps Script 편집기에서 setupSheets() 함수를 직접 실행하세요.
// ============================================================

function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 학생DB
  let s = ss.getSheetByName(SHEET.STUDENTS) || ss.insertSheet(SHEET.STUDENTS);
  if (s.getLastRow() === 0) {
    s.appendRow(['학생ID','이름','성별','생일','연락처','부','학년','반이름','담임선생님','분류','새친구등록일','새친구방문횟수','등록완료여부','반이동이력']);
    s.getRange(1, 1, 1, 14).setFontWeight('bold').setBackground('#4a86e8').setFontColor('#ffffff');
  }

  // 출석기록
  let a = ss.getSheetByName(SHEET.ATTENDANCE) || ss.insertSheet(SHEET.ATTENDANCE);
  if (a.getLastRow() === 0) {
    a.appendRow(['기록ID','학생ID','날짜','출석여부']);
    a.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#4a86e8').setFontColor('#ffffff');
  }

  // 점수기록
  let sc = ss.getSheetByName(SHEET.SCORES) || ss.insertSheet(SHEET.SCORES);
  if (sc.getLastRow() === 0) {
    sc.appendRow(['기록ID','학생ID','날짜','예배점수','성경지참점수','암송점수','성경읽기점수','전도점수','결석사유','입력자']);
    sc.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#4a86e8').setFontColor('#ffffff');
  }

  // 사용자계정
  let acc = ss.getSheetByName(SHEET.ACCOUNTS) || ss.insertSheet(SHEET.ACCOUNTS);
  if (acc.getLastRow() === 0) {
    acc.appendRow(['이름','역할','담당반','비밀번호(해시)','링크코드']);
    acc.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#4a86e8').setFontColor('#ffffff');
    // 기본 임원 계정 생성 (핀: 1234)
    acc.appendRow(['임원', '임원', '전체', hashPin('1234'), 'ADMIN001']);
  }

  // 점수기준
  let cr = ss.getSheetByName(SHEET.CRITERIA) || ss.insertSheet(SHEET.CRITERIA);
  if (cr.getLastRow() === 0) {
    cr.appendRow(['항목명','점수','수정일']);
    cr.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#4a86e8').setFontColor('#ffffff');
    const today = formatDate(new Date());
    cr.appendRow(['예배', 10, today]);
    cr.appendRow(['성경지참', 5, today]);
    cr.appendRow(['암송', 5, today]);
    cr.appendRow(['성경읽기', 1, today]);
    cr.appendRow(['전도', 20, today]);
  }

  SpreadsheetApp.getUi().alert('시트 초기화 완료!');
}

// 선생님 계정 추가 헬퍼
function addTeacherAccount(name, className, pin) {
  const sheet = getSheet(SHEET.ACCOUNTS);
  const code = 'TC_' + Math.random().toString(36).substr(2, 8).toUpperCase();
  sheet.appendRow([name, '선생님', className, hashPin(String(pin)), code]);
  Logger.log(`${name} 선생님 계정 생성 완료. 링크코드: ${code}`);
}

// 일괄 선생님 계정 생성 예시
function setupSampleAccounts() {
  // addTeacherAccount('홍길동', '1부3학년1반', '1234');
  Logger.log('addTeacherAccount() 함수를 수정하여 실행하세요.');
}
