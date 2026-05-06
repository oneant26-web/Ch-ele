# 대구동신교회 초등부 통합 관리 시스템

React + Node.js + Supabase 기반의 초등부 출석·점수 관리 웹앱입니다.

## 화면 구성

| URL | 설명 | 인증 |
|-----|------|------|
| `/attendance?service=1부` | 출석 체크 (1부/2부) | 불필요 |
| `/login` | 선생님/임원 로그인 | — |
| `/teacher` | 점수 입력 | 선생님/임원 |
| `/admin` | 임원 대시보드 | 임원 |

---

## 1. Supabase 프로젝트 설정

### 1-1. 프로젝트 생성

1. [supabase.com](https://supabase.com) 접속 → **New Project** 클릭
2. 프로젝트 이름: `dongshin-elementary` (원하는 이름 사용 가능)
3. Database Password 설정 (기록해두기)
4. Region: **Northeast Asia (Seoul)** 선택 → **Create new project**

### 1-2. 스키마 생성

1. Supabase 대시보드 → 왼쪽 메뉴 **SQL Editor**
2. **New query** 클릭
3. `supabase/schema.sql` 파일 전체 내용 붙여넣기 → **Run** (Ctrl+Enter)
4. `supabase/seed.sql` 파일 전체 내용 붙여넣기 → **Run**
5. 왼쪽 메뉴 **Table Editor**에서 테이블이 생성됐는지 확인

### 1-3. API 키 확인

1. 왼쪽 메뉴 **Project Settings** → **API**
2. 다음 두 값을 복사:
   - **Project URL** → `SUPABASE_URL`
   - **service_role (secret)** → `SUPABASE_SERVICE_KEY` ⚠️ 절대 공개 금지

---

## 2. 로컬 개발 환경 설정

### 2-1. 의존성 설치

```bash
cd dongshin-elementary
npm install
```

### 2-2. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어 아래 값 입력:

```env
SUPABASE_URL=https://xxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=랜덤한-긴-문자열-입력
PORT=3001
```

### 2-3. 개발 서버 실행

**터미널 1** (백엔드):
```bash
npm run server
```

**터미널 2** (프론트엔드):
```bash
npm run dev
```

또는 한 번에:
```bash
npm run dev:all
```

브라우저에서 `http://localhost:5173` 접속

---

## 3. Vercel 배포

### 3-1. GitHub 연동 (권장)

1. 이 프로젝트를 GitHub 저장소에 push
2. [vercel.com](https://vercel.com) → **New Project** → GitHub 저장소 선택
3. **Environment Variables** 에 아래 값 추가:

| 변수명 | 값 |
|--------|-----|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service_role key |
| `JWT_SECRET` | 랜덤 비밀 문자열 |

4. **Deploy** 클릭

### 3-2. Vercel CLI 사용

```bash
npm install -g vercel
vercel login
vercel --prod
```

---

## 4. 초기 계정 정보

| 이름 | 역할 | PIN |
|------|------|-----|
| 관리자 | 임원 (admin) | `0000` |
| 각 선생님 | 선생님 (teacher) | `1234` |

> 선생님 이름 목록: 김지현, 문소희, 김신애, 류희영, 서진선, 김근영, 권경준, 정의헌, 임재한, 김동언, 박정은, 신승훈, 곽혜리, 김민아, 임예린, 김찬송

---

## 5. 기능 설명

### 출석 체크 (`/attendance`)
- 로그인 없이 접근 가능
- 1부/2부 탭으로 구분
- 학생 버튼 한 번 → 출석 체크 ✅, 다시 누르면 취소
- 새친구반은 하단에 별도 표시, 방문 횟수 표기

### 선생님 점수 입력 (`/teacher`)
- 이름 + PIN 로그인 후 접근
- 주일 날짜 자동 설정 (변경 가능)
- 예배/성경지참/암송 체크, 성경읽기 장수, 전도 체크, 결석사유 입력
- 전체 저장 버튼 → 반 점수 요약 표시
- **임원 로그인 시**: 반 선택 드롭다운으로 모든 반 조회·입력 가능

### 임원 대시보드 (`/admin`)

| 탭 | 기능 |
|----|------|
| 주간출석 | 날짜별 1부/2부 학년별 출석 현황 카드 |
| 점수현황 | 주간 전체 학생 점수 테이블 (반별/점수순 정렬) |
| 새친구관리 | 새친구 방문 횟수 확인 및 정식 등록 |
| 반이동 | 학생 검색 후 반/선생님 변경 (기존 점수 유지) |
| 생일조회 | 월별 생일자 조회 (연락처 포함) |
| 점수기준 | 항목별 점수 수정 및 적용일 설정 |

---

## 6. 프로젝트 구조

```
dongshin-elementary/
├── api/
│   ├── index.js        # Express API (Vercel serverless)
│   └── server.js       # 로컬 개발용 서버
├── src/
│   ├── pages/
│   │   ├── Attendance.jsx
│   │   ├── Login.jsx
│   │   ├── Teacher.jsx
│   │   └── Admin.jsx
│   ├── components/
│   │   ├── Toast.jsx
│   │   ├── Spinner.jsx
│   │   └── ProtectedRoute.jsx
│   ├── context/AuthContext.jsx
│   ├── lib/api.js
│   └── App.jsx
├── supabase/
│   ├── schema.sql      # 테이블 생성 스크립트
│   └── seed.sql        # 초기 데이터 (학생 114명 + 선생님 16명)
├── vercel.json
└── .env.example
```

---

## 7. 주의사항

- `SUPABASE_SERVICE_KEY`는 절대 클라이언트 코드에 노출하지 마세요.
- 모든 DB 접근은 백엔드 API를 통해 이루어집니다.
- RLS(Row Level Security)가 활성화되어 있어 anon key로는 직접 접근 불가.
- PIN은 평문 저장됩니다. 실제 운영 시 bcrypt 해싱 적용을 권장합니다.
