// ============================================================
// 대구동신교회 초등부 통합 관리 시스템
// Google Apps Script - 메인 서버 코드
// ============================================================

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // 실제 스프레드시트 ID로 교체

// 시트 이름 상수
const SHEET = {
  STUDENTS: '학생DB',
  ATTENDANCE: '출석기록',
  SCORES: '점수기록',
  ACCOUNTS: '사용자계정',
  CRITERIA: '점수기준'
};

// 학생DB 컬럼 인덱스 (0-based)
const COL_STU = {
  ID: 0, NAME: 1, GENDER: 2, BIRTHDAY: 3, CONTACT: 4,
  PART: 5, GRADE: 6, CLASS: 7, TEACHER: 8, TYPE: 9,
  NEW_DATE: 10, NEW_VISITS: 11, REGISTERED: 12, MOVE_LOG: 13
};

// 출석기록 컬럼 인덱스
const COL_ATT = { ID: 0, STUDENT_ID: 1, DATE: 2, CHECKED: 3 };

// 점수기록 컬럼 인덱스
const COL_SCO = {
  ID: 0, STUDENT_ID: 1, DATE: 2, WORSHIP: 3, BIBLE: 4,
  RECITE: 5, READING: 6, EVANGELISM: 7, ABSENT_REASON: 8, INPUTTER: 9
};

// 사용자계정 컬럼 인덱스
const COL_ACC = { NAME: 0, ROLE: 1, CLASS: 2, PIN_HASH: 3, LINK_CODE: 4 };

// 점수기준 컬럼 인덱스
const COL_CRI = { ITEM: 0, SCORE: 1, DATE: 2 };

// ============================================================
// 웹앱 진입점
// ============================================================
function doGet(e) {
  const params = e.parameter;
  const page = params.page || 'attendance';

  let tmpl;
  switch (page) {
    case 'attendance': tmpl = HtmlService.createTemplateFromFile('PageA'); break;
    case 'score':      tmpl = HtmlService.createTemplateFromFile('PageB'); break;
    case 'dashboard':  tmpl = HtmlService.createTemplateFromFile('PageC'); break;
    case 'newfriend':  tmpl = HtmlService.createTemplateFromFile('PageD'); break;
    default:           tmpl = HtmlService.createTemplateFromFile('PageA');
  }

  tmpl.params = JSON.stringify(params);
  return tmpl.evaluate()
    .setTitle('동신교회 초등부')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
// 스프레드시트 헬퍼
// ============================================================
function getSheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

function getSheetData(name) {
  const sheet = getSheet(name);
  const data = sheet.getDataRange().getValues();
  return data.slice(1); // 헤더 제외
}

function generateId(prefix) {
  return prefix + '_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
}

function formatDate(date) {
  const d = new Date(date);
  return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd');
}

function getSundayOfWeek(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getDay(); // 0=일
  const diff = -day;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() + diff);
  return formatDate(sunday);
}

function hashPin(pin) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    pin,
    Utilities.Charset.UTF_8
  ).map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

// ============================================================
// 계정 / 로그인
// ============================================================
function login(name, pin) {
  const rows = getSheetData(SHEET.ACCOUNTS);
  const hashed = hashPin(String(pin));
  for (const row of rows) {
    if (row[COL_ACC.NAME] === name && row[COL_ACC.PIN_HASH] === hashed) {
      return { ok: true, name: row[COL_ACC.NAME], role: row[COL_ACC.ROLE], class: row[COL_ACC.CLASS] };
    }
  }
  return { ok: false, message: '이름 또는 핀번호가 틀렸습니다.' };
}

function getTeacherList() {
  const rows = getSheetData(SHEET.ACCOUNTS);
  return rows
    .filter(r => r[COL_ACC.ROLE] === '선생님' || r[COL_ACC.ROLE] === '임원')
    .map(r => ({ name: r[COL_ACC.NAME], role: r[COL_ACC.ROLE] }));
}

// ============================================================
// 학생 데이터
// ============================================================
function getStudentsByPart(part) {
  const rows = getSheetData(SHEET.STUDENTS);
  const students = rows
    .filter(r => r[COL_STU.PART] === part)
    .map(r => ({
      id: r[COL_STU.ID],
      name: r[COL_STU.NAME],
      gender: r[COL_STU.GENDER],
      grade: r[COL_STU.GRADE],
      class: r[COL_STU.CLASS],
      teacher: r[COL_STU.TEACHER],
      type: r[COL_STU.TYPE],
      newVisits: r[COL_STU.NEW_VISITS]
    }));
  return students;
}

function getStudentsByClass(className) {
  const rows = getSheetData(SHEET.STUDENTS);
  return rows
    .filter(r => r[COL_STU.CLASS] === className)
    .map(r => ({
      id: r[COL_STU.ID],
      name: r[COL_STU.NAME],
      gender: r[COL_STU.GENDER],
      birthday: r[COL_STU.BIRTHDAY] ? formatDate(r[COL_STU.BIRTHDAY]) : '',
      contact: r[COL_STU.CONTACT],
      type: r[COL_STU.TYPE],
      newVisits: r[COL_STU.NEW_VISITS]
    }));
}

function getAllStudents() {
  const rows = getSheetData(SHEET.STUDENTS);
  return rows.map(r => ({
    id: r[COL_STU.ID],
    name: r[COL_STU.NAME],
    gender: r[COL_STU.GENDER],
    birthday: r[COL_STU.BIRTHDAY] ? formatDate(r[COL_STU.BIRTHDAY]) : '',
    contact: r[COL_STU.CONTACT],
    part: r[COL_STU.PART],
    grade: r[COL_STU.GRADE],
    class: r[COL_STU.CLASS],
    teacher: r[COL_STU.TEACHER],
    type: r[COL_STU.TYPE],
    newDate: r[COL_STU.NEW_DATE] ? formatDate(r[COL_STU.NEW_DATE]) : '',
    newVisits: r[COL_STU.NEW_VISITS],
    registered: r[COL_STU.REGISTERED]
  }));
}

function addStudent(data) {
  const sheet = getSheet(SHEET.STUDENTS);
  const id = generateId('STU');
  sheet.appendRow([
    id, data.name, data.gender, data.birthday, data.contact,
    data.part, data.grade, data.class, data.teacher,
    data.type || '일반', data.newDate || '', data.newVisits || 0,
    data.registered || 'N', ''
  ]);
  return { ok: true, id };
}

function moveStudent(studentId, newClass, newTeacher) {
  const sheet = getSheet(SHEET.STUDENTS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][COL_STU.ID] === studentId) {
      const oldClass = data[i][COL_STU.CLASS];
      const log = data[i][COL_STU.MOVE_LOG] || '[]';
      let history = [];
      try { history = JSON.parse(log); } catch (e) {}
      history.push({ date: formatDate(new Date()), from: oldClass, to: newClass });
      sheet.getRange(i + 1, COL_STU.CLASS + 1).setValue(newClass);
      sheet.getRange(i + 1, COL_STU.TEACHER + 1).setValue(newTeacher);
      sheet.getRange(i + 1, COL_STU.MOVE_LOG + 1).setValue(JSON.stringify(history));
      return { ok: true };
    }
  }
  return { ok: false, message: '학생을 찾을 수 없습니다.' };
}

function promoteNewFriend(studentId, newClass, newTeacher) {
  const sheet = getSheet(SHEET.STUDENTS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][COL_STU.ID] === studentId) {
      sheet.getRange(i + 1, COL_STU.TYPE + 1).setValue('일반');
      sheet.getRange(i + 1, COL_STU.CLASS + 1).setValue(newClass);
      sheet.getRange(i + 1, COL_STU.TEACHER + 1).setValue(newTeacher);
      sheet.getRange(i + 1, COL_STU.REGISTERED + 1).setValue('Y');
      return { ok: true };
    }
  }
  return { ok: false };
}

// ============================================================
// 출석 기록
// ============================================================
function getAttendanceByDate(part, dateStr) {
  const rows = getSheetData(SHEET.ATTENDANCE);
  const students = getStudentsByPart(part);
  const studentIds = students.map(s => s.id);
  const checked = {};
  rows.filter(r => r[COL_ATT.DATE] && formatDate(r[COL_ATT.DATE]) === dateStr && studentIds.includes(r[COL_ATT.STUDENT_ID]))
    .forEach(r => { if (r[COL_ATT.CHECKED]) checked[r[COL_ATT.STUDENT_ID]] = true; });
  return { students, checked };
}

function toggleAttendance(studentId, dateStr, check) {
  const sheet = getSheet(SHEET.ATTENDANCE);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][COL_ATT.STUDENT_ID] === studentId &&
        data[i][COL_ATT.DATE] && formatDate(data[i][COL_ATT.DATE]) === dateStr) {
      sheet.getRange(i + 1, COL_ATT.CHECKED + 1).setValue(check);
      return { ok: true };
    }
  }
  // 새 기록 추가
  sheet.appendRow([generateId('ATT'), studentId, dateStr, check]);
  return { ok: true };
}

function getWeeklyAttendanceSummary(dateStr) {
  const rows = getSheetData(SHEET.ATTENDANCE);
  const students = getSheetData(SHEET.STUDENTS);
  const scoreRows = getSheetData(SHEET.SCORES);

  const summary = {
    '1부': { '3학년': 0, '4학년': 0, '새친구': 0 },
    '2부': { '3학년': 0, '4학년': 0, '새친구': 0 }
  };

  const attendedIds = new Set();

  // 출석체크 기반
  rows.filter(r => r[COL_ATT.DATE] && formatDate(r[COL_ATT.DATE]) === dateStr && r[COL_ATT.CHECKED])
    .forEach(r => attendedIds.add(r[COL_ATT.STUDENT_ID]));

  // 예배점수 > 0 기반
  scoreRows.filter(r => r[COL_SCO.DATE] && formatDate(r[COL_SCO.DATE]) === dateStr && r[COL_SCO.WORSHIP] > 0)
    .forEach(r => attendedIds.add(r[COL_SCO.STUDENT_ID]));

  students.filter(s => attendedIds.has(s[COL_STU.ID])).forEach(s => {
    const part = s[COL_STU.PART];
    const type = s[COL_STU.TYPE];
    const grade = String(s[COL_STU.GRADE]) + '학년';
    if (!summary[part]) return;
    if (type === '새친구') {
      summary[part]['새친구']++;
    } else if (summary[part][grade] !== undefined) {
      summary[part][grade]++;
    }
  });
  return summary;
}

// ============================================================
// 점수 기록
// ============================================================
function getScoreCriteria() {
  const rows = getSheetData(SHEET.CRITERIA);
  const criteria = {};
  rows.forEach(r => { criteria[r[COL_CRI.ITEM]] = Number(r[COL_CRI.SCORE]); });
  return criteria;
}

function getScoresByClass(className, dateStr) {
  const students = getStudentsByClass(className);
  const scoreRows = getSheetData(SHEET.SCORES);
  const result = {};
  students.forEach(s => {
    const row = scoreRows.find(r =>
      r[COL_SCO.STUDENT_ID] === s.id &&
      r[COL_SCO.DATE] && formatDate(r[COL_SCO.DATE]) === dateStr
    );
    result[s.id] = row ? {
      worship: row[COL_SCO.WORSHIP],
      bible: row[COL_SCO.BIBLE],
      recite: row[COL_SCO.RECITE],
      reading: row[COL_SCO.READING],
      evangelism: row[COL_SCO.EVANGELISM],
      absentReason: row[COL_SCO.ABSENT_REASON]
    } : null;
  });
  return { students, scores: result };
}

function saveScores(className, dateStr, scoresData, inputterName) {
  const sheet = getSheet(SHEET.SCORES);
  const data = sheet.getDataRange().getValues();

  for (const studentId in scoresData) {
    const s = scoresData[studentId];
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][COL_SCO.STUDENT_ID] === studentId &&
          data[i][COL_SCO.DATE] && formatDate(data[i][COL_SCO.DATE]) === dateStr) {
        sheet.getRange(i + 1, COL_SCO.WORSHIP + 1).setValue(Number(s.worship) || 0);
        sheet.getRange(i + 1, COL_SCO.BIBLE + 1).setValue(Number(s.bible) || 0);
        sheet.getRange(i + 1, COL_SCO.RECITE + 1).setValue(Number(s.recite) || 0);
        sheet.getRange(i + 1, COL_SCO.READING + 1).setValue(Number(s.reading) || 0);
        sheet.getRange(i + 1, COL_SCO.EVANGELISM + 1).setValue(Number(s.evangelism) || 0);
        sheet.getRange(i + 1, COL_SCO.ABSENT_REASON + 1).setValue(s.absentReason || '');
        sheet.getRange(i + 1, COL_SCO.INPUTTER + 1).setValue(inputterName);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([
        generateId('SCO'), studentId, dateStr,
        Number(s.worship) || 0, Number(s.bible) || 0, Number(s.recite) || 0,
        Number(s.reading) || 0, Number(s.evangelism) || 0,
        s.absentReason || '', inputterName
      ]);
    }
  }
  return { ok: true };
}

function getTotalScores() {
  const scoreRows = getSheetData(SHEET.SCORES);
  const students = getAllStudents();
  const totals = {};

  scoreRows.forEach(r => {
    const sid = r[COL_SCO.STUDENT_ID];
    if (!totals[sid]) totals[sid] = 0;
    totals[sid] += (Number(r[COL_SCO.WORSHIP]) || 0) +
                   (Number(r[COL_SCO.BIBLE]) || 0) +
                   (Number(r[COL_SCO.RECITE]) || 0) +
                   (Number(r[COL_SCO.READING]) || 0) +
                   (Number(r[COL_SCO.EVANGELISM]) || 0);
  });

  return students.map(s => ({
    ...s,
    totalScore: totals[s.id] || 0
  })).sort((a, b) => b.totalScore - a.totalScore);
}

function updateScoreCriteria(items) {
  const sheet = getSheet(SHEET.CRITERIA);
  const data = sheet.getDataRange().getValues();
  const today = formatDate(new Date());
  for (const item of items) {
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][COL_CRI.ITEM] === item.name) {
        sheet.getRange(i + 1, COL_CRI.SCORE + 1).setValue(item.score);
        sheet.getRange(i + 1, COL_CRI.DATE + 1).setValue(today);
        found = true;
        break;
      }
    }
    if (!found) sheet.appendRow([item.name, item.score, today]);
  }
  return { ok: true };
}

// ============================================================
// 새친구 관리
// ============================================================
function getNewFriends() {
  const rows = getSheetData(SHEET.STUDENTS);
  return rows
    .filter(r => r[COL_STU.TYPE] === '새친구')
    .map(r => ({
      id: r[COL_STU.ID],
      name: r[COL_STU.NAME],
      part: r[COL_STU.PART],
      grade: r[COL_STU.GRADE],
      newDate: r[COL_STU.NEW_DATE] ? formatDate(r[COL_STU.NEW_DATE]) : '',
      newVisits: Number(r[COL_STU.NEW_VISITS]) || 0
    }));
}

function incrementNewFriendVisit(studentId) {
  const sheet = getSheet(SHEET.STUDENTS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][COL_STU.ID] === studentId) {
      const current = Number(data[i][COL_STU.NEW_VISITS]) || 0;
      sheet.getRange(i + 1, COL_STU.NEW_VISITS + 1).setValue(current + 1);
      return { ok: true, newVisits: current + 1 };
    }
  }
  return { ok: false };
}

// ============================================================
// 생일 조회
// ============================================================
function getBirthdaysByMonth(month) {
  const rows = getSheetData(SHEET.STUDENTS);
  return rows
    .filter(r => {
      if (!r[COL_STU.BIRTHDAY]) return false;
      const d = new Date(r[COL_STU.BIRTHDAY]);
      return d.getMonth() + 1 === Number(month);
    })
    .map(r => ({
      id: r[COL_STU.ID],
      name: r[COL_STU.NAME],
      part: r[COL_STU.PART],
      grade: r[COL_STU.GRADE],
      class: r[COL_STU.CLASS],
      birthday: formatDate(r[COL_STU.BIRTHDAY])
    }))
    .sort((a, b) => a.birthday.localeCompare(b.birthday));
}

// ============================================================
// 반 목록
// ============================================================
function getClassList() {
  const rows = getSheetData(SHEET.STUDENTS);
  const classes = {};
  rows.forEach(r => {
    const key = r[COL_STU.CLASS];
    if (key && !classes[key]) {
      classes[key] = { name: key, teacher: r[COL_STU.TEACHER], part: r[COL_STU.PART], grade: r[COL_STU.GRADE] };
    }
  });
  return Object.values(classes);
}

// ============================================================
// 클라이언트에서 호출하는 API 래퍼 (google.script.run 용)
// ============================================================
function apiLogin(name, pin) { return JSON.stringify(login(name, pin)); }
function apiGetTeacherList() { return JSON.stringify(getTeacherList()); }
function apiGetStudentsByPart(part) { return JSON.stringify(getStudentsByPart(part)); }
function apiGetAttendance(part, dateStr) { return JSON.stringify(getAttendanceByDate(part, dateStr)); }
function apiToggleAttendance(studentId, dateStr, check) { return JSON.stringify(toggleAttendance(studentId, dateStr, check)); }
function apiGetWeeklySummary(dateStr) { return JSON.stringify(getWeeklyAttendanceSummary(dateStr)); }
function apiGetScoreCriteria() { return JSON.stringify(getScoreCriteria()); }
function apiGetScoresByClass(className, dateStr) { return JSON.stringify(getScoresByClass(className, dateStr)); }
function apiSaveScores(className, dateStr, scoresJson, inputterName) {
  return JSON.stringify(saveScores(className, dateStr, JSON.parse(scoresJson), inputterName));
}
function apiGetTotalScores() { return JSON.stringify(getTotalScores()); }
function apiGetNewFriends() { return JSON.stringify(getNewFriends()); }
function apiIncrementVisit(studentId) { return JSON.stringify(incrementNewFriendVisit(studentId)); }
function apiGetBirthdays(month) { return JSON.stringify(getBirthdaysByMonth(month)); }
function apiGetClassList() { return JSON.stringify(getClassList()); }
function apiMoveStudent(studentId, newClass, newTeacher) { return JSON.stringify(moveStudent(studentId, newClass, newTeacher)); }
function apiPromoteNewFriend(studentId, newClass, newTeacher) { return JSON.stringify(promoteNewFriend(studentId, newClass, newTeacher)); }
function apiUpdateCriteria(itemsJson) { return JSON.stringify(updateScoreCriteria(JSON.parse(itemsJson))); }
function apiAddStudent(dataJson) { return JSON.stringify(addStudent(JSON.parse(dataJson))); }
function apiGetSundayOfWeek(dateStr) { return getSundayOfWeek(dateStr); }
