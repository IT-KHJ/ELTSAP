# ELT 거래처 현황 보고서

Next.js (App Router) + TypeScript + Supabase 기반. SAP 데이터는 Supabase에 동기화 후 조회만 하며, SAP 원본은 수정하지 않습니다.

## 요구사항

- Node.js 18+
- Supabase 프로젝트

## 설정

1. `.env.local`에 Supabase URL 및 키 입력
2. **SAP SQL Server 접속 정보** (SAP 원본 미러 동기화용, neelt 백엔드와 동일한 방식): `.env.local`에 아래 변수 설정
   - `SAP_SQL_SERVER` — 호스트 또는 `호스트\인스턴스` (예: `MYPC\SQLEXPRESS`). `\` 있으면 Named Instance로 접속(port 미사용)
   - `SAP_SQL_DATABASE` — DB 이름
   - `SAP_SQL_USER` / `SAP_SQL_PASSWORD` — 로그인
   - (선택) `SAP_SQL_PORT` — 기본 1433. 인스턴스 사용 시 생략
   - (선택) `SAP_SQL_TRUST_CERT=false` — 자체 서명 인증서 허용은 기본 **true** (neelt와 동일하게 로컬/내부 서버 연동 용이)

## DB 마이그레이션

`supabase/migrations/001_initial_schema.sql`을 Supabase SQL Editor에서 실행하거나, Supabase CLI로 마이그레이션 적용.

## 실행

```bash
npm install
npm run dev
```

- 메뉴: 거래처 현황(마감기준 `/internal/report`, 판매집계 `/internal/sales-status-b`, 판매기준 `/internal/sales-status`), 거래처 매출 대시보드, 거래처 거래원장, 거래처 관리, 설정(SAP 동기화 상태·점검 정보)

## 동기화 방식

- SAP 원본 테이블(ELT 거래처)을 Supabase `sap_*` 테이블에 그대로 적재·동기화하고(`scripts/sap-mirror/`), 리포트는 리포트별 SQL 뷰/함수(`rpt_*`)로 계산한다. 실행·일정은 `DEPLOY.md` 4절 참조.
- 설정 화면에서는 동기화 결과만 조회한다(수동 실행 버튼 없음).

## 인쇄

보고서 조회 후 **인쇄** 버튼 또는 브라우저 인쇄(Ctrl+P). `@media print`로 A4 가로, 1페이지, `.no-print` 숨김 처리됨.
