# ELTSAP 배포 가이드

## 1. GitHub (완료)

- 저장소: https://github.com/IT-KHJ/ELTSAP
- `main` 브랜치에 소스 푸시 완료.

---

## 2. Vercel 배포

### 방법 A: Vercel 대시보드 (권장)

1. **Vercel 로그인**  
   https://vercel.com 에서 로그인 (GitHub 계정 연동 가능).

2. **프로젝트 가져오기**  
   - **Add New…** → **Project**  
   - **Import Git Repository**에서 `IT-KHJ/ELTSAP` 선택  
   - **Import** 클릭  

3. **설정**  
   - **Framework Preset**: Next.js (자동 감지)  
   - **Root Directory**: `./` (기본값)  
   - **Build Command**: `next build` (기본값)  
   - **Output Directory**: `.next` (기본값)  

4. **환경 변수 설정** (중요)  
   **Environment Variables**에 로컬 `.env.local`과 동일한 값 추가:

   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase 프로젝트 URL  
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key  
   - (선택) `SAP_SQL_SERVER`, `SAP_SQL_DATABASE`, `SAP_SQL_USER`, `SAP_SQL_PASSWORD` — SAP 직접 연동 시  
   - (선택) `SYNC_ITEMLIST_URL`, `SYNC_SALES_URL` 등 — 외부 동기화 API 사용 시  
   - (선택) `CRON_SECRET` — 자동 동기화 Cron(매일 일괄·매시) 호출 시 Bearer 검증용. 16자 이상 권장. 미설정 시 Cron 인증 생략.

   Production / Preview / Development 중 필요한 환경에 체크 후 저장.

5. **Deploy**  
   **Deploy** 클릭 후 빌드가 끝나면 배포 URL이 생성됩니다.

---

### 방법 B: Vercel CLI

1. **로그인**  
   ```bash
   npx vercel login
   ```
   이메일 또는 GitHub로 로그인.

2. **배포**  
   프로젝트 루트에서:
   ```bash
   npx vercel
   ```
   첫 실행 시 프로젝트 연결, 팀/스코프 선택 등 질문에 답한 뒤 배포됩니다.

3. **프로덕션 배포**  
   ```bash
   npx vercel --prod
   ```

4. **환경 변수**  
   CLI로 추가할 경우:
   ```bash
   npx vercel env add NEXT_PUBLIC_SUPABASE_URL
   npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```
   또는 대시보드 **Project → Settings → Environment Variables**에서 설정.

---

## 3. 배포 후 확인

- Vercel에서 제공하는 URL(예: `https://eltsap-xxx.vercel.app`)로 접속  
- `/internal/login` 로그인 및 내부 페이지 동작 확인  
- Supabase 연결 및 보고서/동기화 API 정상 동작 여부 확인  

---

## 4. 로컬 자동 동기화 (localhost)

Vercel에서는 방화벽 등으로 SAP 연결이 어려울 수 있으므로, **localhost에서 실행 중인 앱**을 기준으로 동기화를 스케줄 실행합니다.

### 사전 조건

- `npm run start`로 Next.js 앱이 localhost에서 실행 중
- `.env.local`에 `CRON_SECRET`, `PORT`(기본 3000) 설정
- SAP 접속 가능한 네트워크(방화벽 이슈 회피)

### 스크립트

| 스크립트 | 대상 | 실행 |
|---------|------|------|
| `npm run sync:orders` | 입금·기타출고·매출·판매(증분) | 매시간 |
| `npm run sync:daily` | 거래처·품목·입금·기타출고·매출·판매 전 단계 전체 | 매일 오전 9시(예시) |

### Windows 작업 스케줄러 예시

1. **작업 스케줄러** 실행 → **기본 작업 만들기**
2. **매시 정각 (판매 동기화)**  
   - 프로그램: `cmd.exe`  
   - 인수: `/c cd /d D:\projects\eltsap && npm run sync:orders`  
   - 시작 위치: `D:\projects\eltsap`  
   - 트리거: 매시 0분 반복
3. **매일 일괄 동기화 (예: 오전 9시)**  
   - 프로그램: `cmd.exe`  
   - 인수: `/c cd /d D:\projects\eltsap && npm run sync:daily`  
   - 시작 위치: `D:\projects\eltsap`  
   - 트리거: 매일 원하는 시각(예: 오전 9:00)

경로 `D:\projects\eltsap`는 실제 프로젝트 경로로 변경하세요.

### 결과

- 설정 화면 점검 정보 영역 우측에 표시 (매일 9시 일괄·매시 증분 이력)
- `supabase/migrations/012_add_daily_auto_sync_results.sql`, `017_add_orders_count_to_daily_auto_sync.sql`, `018_daily_and_hourly_sync_history.sql` 적용 필요

---

## 5. Supabase URL 허용 (인증)

Supabase **Authentication → URL Configuration**에서  
**Redirect URLs**에 Vercel 배포 URL을 추가해야 로그인 리다이렉트가 동작합니다.

- 예: `https://eltsap-xxx.vercel.app/**`  
- Site URL도 동일하게 설정 권장  
