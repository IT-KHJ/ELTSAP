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
   - `SUPABASE_SERVICE_ROLE_KEY` — 서버 조회용(리포트·관리 화면)  
   - SAP 접속 정보(`SAP_SQL_*`)는 Vercel에 필요 없음 — SAP 동기화는 로컬 PC에서만 실행(4절)

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
- Supabase 연결 및 보고서 API, 설정 화면의 SAP 동기화 상태 표시 확인  

---

## 4. SAP 동기화 (로컬 PC 작업 스케줄러)

Vercel에서는 방화벽 등으로 SAP 연결이 어려우므로 SAP 접속이 되는 PC에서 동기화를 스케줄 실행한다. 기존 앱 경유 동기화(`/api/sync/*`, `/api/cron/*`, `sync:daily`·`sync:orders`)는 2026-10-28 SAP 원본 미러로 대체되어 삭제됨.

### SAP 원본 미러 동기화 (`sap_*` 테이블)

Next.js 앱 실행 없이 `scripts/sap-mirror/sync.ts`를 직접 실행한다. 회사 DBSafer 세션이 끊기면 SAP 접속이 불가하므로 **평일 업무 시간(세션 재접속 9:30~10:00 이후)**에만 실행한다.

| 작업 이름 | 모드 | 일정 |
|---|---|---|
| `SAP미러_매시간` | hourly (신규 문서 + 최근 31일 변경분) | 평일 10:10~18:10 매시 |
| `SAP미러_매일` | daily (최근 400일 변경분 + 마스터 + 신규 ELT 거래처 + 최근 3개월 대사) | 평일 12:30 |
| `SAP미러_매주` | weekly (전체 기간 변경분 + 마스터 전체 정리 + 최근 3개월 대사) | 금 16:30 |

- 전체 기간 대사는 자동 실행하지 않음(SAP 디스크 부하). 필요 시 수동: `npx tsx scripts/sap-mirror/sync.ts recon --full` (거래처 1곳씩 나눠 조회)

- 실행: `conhost.exe --headless cmd.exe /c D:\projects\eltsap\scripts\sap-mirror\run-scheduled.cmd <모드>` (창 없이 실행, "사용자가 로그온할 때만")
- 로그: `%LOCALAPPDATA%\eltsap-sap-mirror\<모드>.log`, 실행 이력: Supabase `sap_mirror_runs` (설정 화면 "SAP 동기화 상태"에 표시)
- 종료 코드: 0 성공, 1 실패, 2 SAP 접속 불가(DBSafer 세션 만료·연차 등 → 다음 실행에서 이어서 처리), 3 다른 실행 진행 중(건너뜀), 4 SAP 부하 감지로 중단(쿼리 30초 초과/응답 없음), 5 부하 정지(HALT) 상태 — 원인 확인 후 `--clear-halt`로 해제해야 재개
- 수동 실행/초기 적재: `npx tsx scripts/sap-mirror/sync.ts <init|hourly|daily|weekly|recon|reload>` — 장시간 작업은 PowerShell `Start-Process`로 실행(Git Bash 백그라운드 실행 시 중복 실행 발생 사례 있음)

---

## 5. Supabase URL 허용 (인증)

Supabase **Authentication → URL Configuration**에서  
**Redirect URLs**에 Vercel 배포 URL을 추가해야 로그인 리다이렉트가 동작합니다.

- 예: `https://eltsap-xxx.vercel.app/**`  
- Site URL도 동일하게 설정 권장  
