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

## 4. Supabase URL 허용 (인증)

Supabase **Authentication → URL Configuration**에서  
**Redirect URLs**에 Vercel 배포 URL을 추가해야 로그인 리다이렉트가 동작합니다.

- 예: `https://eltsap-xxx.vercel.app/**`  
- Site URL도 동일하게 설정 권장  
