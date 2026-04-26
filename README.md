# 대구동신교회 초등부 통합 관리 시스템

Google Apps Script 기반 웹앱입니다.

## 파일 구조

| 파일 | 역할 |
|------|------|
| `Code.gs` | 서버 메인 로직 (doGet, 데이터 CRUD, API 래퍼) |
| `Setup.gs` | 시트 초기화, 계정 생성 헬퍼 |
| `Common.html` | 공통 CSS + JS 유틸 (include로 삽입) |
| `PageA.html` | 출석체크 (로그인 불필요, QR링크 공유용) |
| `PageB.html` | 선생님 점수입력 (핀 로그인) |
| `PageC.html` | 임원 대시보드 (통계/반이동/생일/기준수정/학생추가) |
| `PageD.html` | 새친구 관리 (방문기록/일반반 배치) |
| `appsscript.json` | 웹앱 배포 설정 |

## 배포 순서

### 1. Google Sheets 생성
구글 스프레드시트를 새로 만들고 URL에서 ID를 복사합니다.
`https://docs.google.com/spreadsheets/d/[여기가 ID]/edit`

### 2. Apps Script 프로젝트 연결
- 스프레드시트 상단 메뉴 → 확장 프로그램 → Apps Script
- 위 파일들을 모두 Apps Script 편집기에 복사/붙여넣기

### 3. SPREADSHEET_ID 설정
`Code.gs` 상단의 `YOUR_SPREADSHEET_ID_HERE`를 실제 ID로 교체

### 4. 시트 초기화
Apps Script 편집기에서 `setupSheets()` 함수를 직접 실행

### 5. 웹앱 배포
- 편집기 상단 → 배포 → 새 배포
- 유형: 웹앱
- 실행 계정: 나 (스프레드시트 소유자)
- 액세스: 모든 사용자 (익명 포함)

### 6. 링크 생성

| 용도 | URL |
|------|-----|
| 1부 출석체크 | `[웹앱URL]?page=attendance&part=1부` |
| 2부 출석체크 | `[웹앱URL]?page=attendance&part=2부` |
| 선생님 점수입력 | `[웹앱URL]?page=score` |
| 임원 대시보드 | `[웹앱URL]?page=dashboard` |
| 새친구 관리 | `[웹앱URL]?page=newfriend` |

### 7. 선생님 계정 생성
`Setup.gs`의 `addTeacherAccount()` 함수를 수정 후 실행:
```javascript
addTeacherAccount('홍길동', '1부3학년1반', '1234');
```

## 초기 임원 계정
- 이름: `임원`
- 핀번호: `1234` (배포 후 반드시 변경)

## 주의사항
- 학생 데이터를 직접 스프레드시트 [학생DB] 시트에 입력하거나, 임원 대시보드의 학생추가 기능 사용
- 반이름 형식 통일 권장 (예: `1부3학년1반`)
- 배포 후 반드시 기본 임원 핀번호(1234) 변경
