# ELTSAP — 현재 세션 시작점

> 이 파일만 읽으면 현재 작업을 즉시 시작할 수 있다.
> 세션 종료 시 반드시 업데이트할 것.
> 전체 설계 참조: `프로젝트_내용.md` | 현재 단계 상세: `프로젝트_추적기.md` | 완료 이력: `프로젝트_추적기_아카이브.md`

---

## 현재 단계: 8단계 — SAP 원본 미러 계층 + 거래처 거래원장 (적재·검증 완료, 거래원장 1차 완료 — 사용자 화면 확인 대기)

- 2026-10-27 상태: ELT 183곳 전체 이력 적재 완료(580만 행, DB 4.5GB), 전체 기간 대사 일치(당월 신규 입금 1건은 다음 hourly에서 반영 확인), 스케줄(평일 10:10~18:10 hourly / 12:30 daily / 금 16:30 weekly) 정상 동작, SAP 부하 안전장치(쿼리 30초 초과 시 중단+HALT) 적용
- 거래원장: `/internal/ledger` (메뉴 "거래처 거래원장"), 규칙은 `027_add_rpt_ledger.sql`. C001201 엑셀과 일치, ELT 183곳 중 161곳 9/30 잔액이 SAP 채권과 일치(나머지 22곳은 미청구 납품 등 납품 기준 차이 — 개별 확인은 후속)
- Supabase 컴퓨트: Micro(1GB). 거래원장 조회 1~4.5초(대형 거래처 첫 조회는 8초 제한 근접 가능)

- 2단계 동기화 엔진 구현·파일럿(C001201) 검증 완료(대사 불일치 0, 엑셀 잔액 일치). 실행: `npx tsx scripts/sap-mirror/sync.ts <init|hourly|daily|weekly|recon|reload>`
- 장시간 실행은 Git Bash 백그라운드 금지(중복 실행 발생) → PowerShell `Start-Process` 사용. 상태는 `sap_mirror_runs` 테이블에서 확인.

- 방향: SAP 유의미 테이블 원본을 Supabase(`sap_*` 테이블)에 그대로 적재·동기화, 리포트별 규칙은 SQL 함수로. 범위 ELT 거래처, 기존 동기화와 독립. 상세는 `프로젝트_추적기.md` 8단계.
- 1단계 완료: `scripts/sap-mirror/schema.json`(유일한 기준) → `generate-ddl.ts`로 `025_add_sap_mirror_tables.sql` 생성 → Supabase 적용·검증 완료(빈 테이블 24개). 새 테이블/컬럼은 `inspect-sap-table.ts`로 점검 후 명세 수정·재생성.
- 미커밋: 8단계 관련 파일 전체 (`scripts/sap-mirror/`, `025_*.sql`, `package.json`, 문서)
- **SAP 부하 주의**: 조회는 인덱스(거래처코드/기본키) 기반 소량, READ UNCOMMITTED, 순차 실행.

## 이전 단계: 7단계 — 히스토리 백필 스크립트 (완료)

| 항목 | 상태 |
|------|------|
| SAP 연동 동기화 파이프라인 (거래처/품목/매출/입금/기타출고/판매) | 완료 (1~6단계, 2026-04-01 기준) |
| 권한 관리 시스템 (메뉴별 사용자 권한) | 완료 |
| 거래처 현황 보고서 3종 (마감기준/판매기준 A안/판매기준 B안) | 완료 |
| `scripts/backfill-history.ts` (과거 데이터 백필) | 완료, 커밋됨 (cf2e197) |
| `package.json`에 `backfill:history` 스크립트 등록 | 완료, 커밋됨 |
| 실제 SAP 연결 환경에서 백필 스크립트 검증 | 완료 (2026-09-14, 아래 참조) |

---

## 최근 완료 작업 (2026-09-14)

**NE능률 브랜드 디자인 시스템(로고/폰트/컬러) 적용** — `~/.claude/skills/ne-design-system` 기준

- 로고: `public/ne-ci-logo.png`를 공식 컬러(레드) 국문 로고 파일로 교체 (경로 동일, 코드 변경 없음)
- 폰트: `public/fonts/{Pretendard,KOROAD,Paperlogy}/` 로컬 파일 추가, `app/globals.css`에 `@font-face` 등록, `app/layout.tsx`의 Pretendard CDN 링크 제거(로컬 self-host 전환), 로그인/점검 페이지 타이틀에 KOROAD·Paperlogy 적용
- 컬러: `tailwind.config.ts`의 `primary`를 공식 레드 `#e83828`로 교체(hover/light 재계산), `ne-black`/`ne-blue`/`ne-gold`/`ne-silver` 서브 컬러 토큰 추가
- 상세 내용은 `프로젝트_내용.md`의 "디자인 시스템 (브랜드 CI)" 섹션 참조

**확인 필요:** 브라우저 육안 검증 아직 안 됨 (dev 서버 중복 실행 방지를 위해 이번 세션에서는 빌드/dev 서버를 직접 실행하지 않음) — 다음 세션 또는 사용자 쪽에서 로그인/사이드바/점검 페이지 렌더링 확인 필요.

---

**동기화 상태 화면 캐싱 버그 수정 + SAP 데이터 정합성 검증**

- 증상: 로컬 스케줄러(작업 스케줄러, 매시간)로 동기화를 돌려도 `/internal/sync` 화면의 "마지막 동기화" 시각이 계속 예전 값(8/26)에 머무름. 실제 DB는 정상 갱신되고 있었음(화면 표시만 문제).
- 원인: `getSupabaseAdmin()`이 만드는 Supabase 클라이언트의 내부 `fetch()`가 Next.js 14의 fetch 캐싱에 걸려, 라우트를 `dynamic = "force-dynamic"`으로 지정해도 개별 fetch 응답이 캐시된 채 갱신되지 않음.
- 조치: `lib/supabase.ts`에 캐시 없는 전용 함수 `getSupabaseAdminNoCache()` 추가(기존 `getSupabaseAdmin()`은 무변경, 다른 화면 영향 없음 확인) → `lib/sync-metadata.ts`, `app/api/sync/debug/route.ts`만 이 함수로 교체. **미커밋** (변경 파일: `lib/supabase.ts`, `lib/sync-metadata.ts`, `app/api/sync/debug/route.ts`, `app/api/sync/metadata/route.ts`)
- 참고: `.claude/skills/sap-sync-debug/SKILL.md` 신규 추가(SAP 동기화 연결 오류 진단용, 미커밋).
- 겸사겸사 4~5개월 미사용 기간 SAP 데이터 누락 여부 점검: SAP 실시간 조회 대사 결과 매출/입금/기타출고는 12개월 중 거의 전 구간 완전 일치(누락 없음). 품목(itemlist)만 SAP 37,719건 vs Supabase 37,682건으로 37건 누락 확인 → 사용자가 수동 전체 동기화 실행, **37,719건 일치 확인 완료**.

**미해결로 남은 것:** 왜 매일 아침 일괄 배치(`sync:daily`)가 8/26 이후로 거래처/품목을 자동 갱신하지 못했는지 원인 미파악. Windows 작업 스케줄러 설정(사용자가 직접 확인 예정) 또는 다른 원인일 수 있음 — 재발 방지를 위해 다음 세션에서 확인 필요.

---

## 최근 조사/트러블슈팅 메모 (2026-08-18)

- 거래처/품목 "전체 동기화" 시 `SAP SQL Server 연결 정보 또는 SYNC_CUSTOMER_URL이 설정되지 않았습니다.` 오류 발생 건 조사 완료.
  - 로컬 `.env.local`은 SAP_SQL_* 4종 모두 정상 설정되어 있어 로컬 실행 시 문제 없음.
  - Vercel 배포 환경에는 SAP_SQL_*/SYNC_*_URL이 설계상 선택 항목 — 방화벽 문제로 Vercel에서 SAP 직접 접속이 어려워 로컬 실행 앱 기준으로 동기화하도록 되어 있음(`DEPLOY.md` 4절).
  - 결론: 코드 버그 아님. 어느 환경(localhost vs Vercel 배포 URL)에서 실행했는지에 따라 조치 방향이 갈림 — **미해결, 사용자 확인 대기 중**.

---

## 즉시 다음 작업 (우선순위순)

0. 8단계: 5단계(기존 리포트 → SAP 미러 기준 전환) 완료. 6단계 A~C 완료(설정 화면 미러 상태, 거래처 관리 SAP 기준, 기존 동기화 코드 삭제, `034`·`035` 마이그레이션) → 사용자 설정·거래처 관리 화면 확인 → 1~2주 운영 후(2026-11-11 전후) D: 기존 테이블 CSV 백업 후 삭제. 그 외: 22곳 잔액 차이 — 검토 자료 준비 완료(`scripts/검토_22곳_잔액차이_20260930.xlsx`, 커밋 금지), 2026-10-30 내부조정(321) '채권조정' 포함(`036`) + 거래원장 매출을 송장 기준으로 변경(`037`, 날짜는 납품일) → 183곳 9/30 잔액 SAP 채권과 전부 일치. 미커밋(036·037, ledger page.tsx 문구, types/ledger.ts 주석), 사용자 거래원장 화면 확인 대기. 기존 예약 작업 2개는 2026-10-29 삭제 완료. 커밋·push 완료(2026-10-28: 7ebde9b 디자인, f2a4096 8단계), Vercel 프로덕션 배포 성공(4월 이후 멈췄던 자동 배포는 프로젝트 Git 재연결로 해결, DEPLOY.md 기록). 커밋 제외: 거래원장 원본 엑셀(실거래 데이터), `.claude/skills/sap-sync-debug`(삭제된 기존 동기화용)
1. 동기화 캐싱 버그 수정분 검토 후 커밋 (`lib/supabase.ts`, `lib/sync-metadata.ts`, `app/api/sync/debug/route.ts`, `app/api/sync/metadata/route.ts`, `.claude/skills/sap-sync-debug/`)
2. `sync:daily` 일괄 배치 미실행 건: 2026-10-27 확인 결과 작업 스케줄러 `전체_동기화`/`판매_동기화` 둘 다 **Disabled** 상태(마지막 실행 10/01, 결과 0). 8/26 이후 자동 갱신 실패는 DBSafer 세션 만료(야간/주말 SAP 접속 불가)와 관련 가능성 — 미확정
3. (선택) SAP 연결 오류 재발 시 실행 환경(로컬/Vercel) 확인 후 조치

---

## 알려진 미해결/보류 이슈

- RLS 정책: `023_fix_rls_always_true_policies.sql`에서 강화했다가 바로 다음 `024_revert_rls_policy_changes.sql`에서 전면 롤백됨 — 현재 대부분 테이블이 `USING(true)` 전체 허용 상태. 재강화 여부 미결정. (`프로젝트_내용.md` "데이터 모델 현황" 참조)
- 거래처 현황(판매기준) A안/B안이 독립 구현으로 존재해 코드 중복 있음 — 통합 여부 미논의.
