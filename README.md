# ELT 거래처 현황 보고서

Next.js (App Router) + TypeScript + Supabase 기반. SAP 데이터는 Supabase에 동기화 후 조회만 하며, SAP 원본은 수정하지 않습니다.

## 요구사항

- Node.js 18+
- Supabase 프로젝트

## 설정

1. `.env.local`에 Supabase URL 및 키 입력
2. **SAP SQL Server 직접 동기화** (권장, neelt 백엔드와 동일한 방식): `.env.local`에 아래 변수 설정
   - `SAP_SQL_SERVER` — 호스트 또는 `호스트\인스턴스` (예: `MYPC\SQLEXPRESS`). `\` 있으면 Named Instance로 접속(port 미사용)
   - `SAP_SQL_DATABASE` — DB 이름
   - `SAP_SQL_USER` / `SAP_SQL_PASSWORD` — 로그인
   - (선택) `SAP_SQL_PORT` — 기본 1433. 인스턴스 사용 시 생략
   - (선택) `SAP_SQL_TRUST_CERT=false` — 자체 서명 인증서 허용은 기본 **true** (neelt와 동일하게 로컬/내부 서버 연동 용이)
3. (대안) 동기화 소스 URL: SAP 미설정 시 `SYNC_*_URL`에서 JSON을 가져와 UPSERT

## DB 마이그레이션

`supabase/migrations/001_initial_schema.sql`을 Supabase SQL Editor에서 실행하거나, Supabase CLI로 마이그레이션 적용.

## 실행

```bash
npm install
npm run dev
```

- 대시보드: `/`
- 거래처 현황 보고서: `/report` (기간·거래처 선택 후 조회, 인쇄 시 A4 가로 1페이지)
- 동기화: `/sync` (거래처/품목/매출/입금/기타출고 개별 버튼)

## 동기화 방식

- **GET** `/api/sync/customer/run`, … `/api/sync/saleetc/run` (동기화 페이지 버튼)
  1. **SAP SQL Server 설정 시**: SAP DB에 직접 접속해 SELECT(읽기 전용) 후 Supabase UPSERT
  2. **미설정 시**: `SYNC_*_URL`에서 JSON을 가져와 UPSERT
- **POST** `/api/sync/customer`, … `/api/sync/saleetc`  
  body: `{ "data": [ ... ] }` → Supabase UPSERT만 (외부 ETL 등에서 호출용)

## 인쇄

보고서 조회 후 **인쇄** 버튼 또는 브라우저 인쇄(Ctrl+P). `@media print`로 A4 가로, 1페이지, `.no-print` 숨김 처리됨.
