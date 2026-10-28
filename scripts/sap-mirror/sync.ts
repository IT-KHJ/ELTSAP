/**
 * SAP 원본 미러 동기화 엔진 (기존 동기화와 완전히 별개)
 *
 * 실행: npx tsx scripts/sap-mirror/sync.ts <모드> [옵션]
 *   init    초기 적재 (마스터 → 거래처별 문서/입금/분개). 중단 후 재실행 시 이어서 진행
 *           --customer C001201[,C...]  지정 거래처만 (파일럿/추가 적재)
 *   hourly  신규 문서(기본키 기준) + 최근 31일 전기분 중 변경 문서
 *   daily   최근 400일 전기분 중 변경 문서 + 마스터 변경분 + 신규 ELT 거래처 적재 + 최근 3개월 대사
 *   weekly  전체 기간 변경 문서 + 마스터 전체 갱신/정리 + 최근 3개월 대사
 *   recon   대사만 (월별 건수/금액 SAP vs Supabase). 기본 최근 3개월, --full 전체 기간(거래처 1곳씩 조회)
 *   reload  --tables ODLN[,ORCT,JDT1,MASTERS] [--customer ...]  지정 테이블 재적재 (컬럼 추가 후 등)
 *   공통    --force  실행 중 잠금 무시, --clear-halt  SAP 부하 정지 해제
 *
 * 종료 코드: 0 성공, 1 실패, 2 SAP 접속 불가(DBSafer 세션 만료 등 → 다음 실행에서 이어서), 3 다른 실행 진행 중,
 *           4 SAP 부하 감지 중단(쿼리 30초 초과/응답 없음 — 재시도하지 않음, 이후 모든 실행 정지),
 *           5 정지(HALT) 상태라 실행 안 함 — 원인 확인 후 `--clear-halt`로 해제
 *
 * SAP 부하: 연결 1개·순차 실행·쿼리 간격·느린 쿼리 시 자동 감속(sap-source.ts),
 * 모든 조회는 인덱스(기본키/거래처코드/전기일자/ShortName) 기반. 전체 스캔은 weekly의 변경 감지뿐.
 * SAP 원본은 수정하지 않음. (.env.local에 SAP_SQL_*, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import sql from "mssql";
import { loadSpec, getTable, selectList, type MirrorSpec } from "./spec";
import { SapSource, SapOverloadError, SapUnavailableError, inList } from "./sap-source";
import { MirrorWriter } from "./mirror-writer";

type Row = Record<string, unknown>;
type Tier = "hourly" | "daily" | "weekly";

const DOC_FAMILIES: [header: string, line: string][] = [
  ["ORDR", "RDR1"],
  ["ODLN", "DLN1"],
  ["ORDN", "RDN1"],
  ["OINV", "INV1"],
  ["ORIN", "RIN1"],
  ["OIGE", "IGE1"],
];
const PAGED_MASTERS: [table: string, key: string][] = [
  ["OCRD", "CardCode"],
  ["OITM", "ItemCode"],
];
const SMALL_MASTERS = ["OCRG", "OITB", "OOCR", "OSLP"];
/** 변경 감지 범위(전기일자 기준 일수). null = 전체 기간 */
const TIER_DOC_DAYS: Record<Tier, number | null> = { hourly: 31, daily: 400, weekly: null };
const HEADER_CHUNK = 200;
const MASTER_PAGE = 2000;
const AUTO_INIT_PER_RUN = 10;

const ymd8 = (ymd: string) => ymd.replace(/-/g, "");
function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function log(msg: string) {
  console.log(`[${new Date().toLocaleTimeString("ko-KR", { hour12: false })}] ${msg}`);
}

class MirrorSync {
  constructor(
    private spec: MirrorSpec,
    private sap: SapSource,
    private w: MirrorWriter
  ) {}

  private async sapToday(): Promise<string> {
    const r = await this.sap.query<{ d: string }>("SELECT CONVERT(char(10), GETDATE(), 23) AS d");
    return r[0].d;
  }

  private async eltCustomers(): Promise<string[]> {
    const r = await this.sap.query<{ c: string }>(
      `SELECT CardCode AS c FROM OCRD WHERE ${this.spec.eltCustomerFilter} ORDER BY CardCode`
    );
    return r.map((x) => x.c);
  }

  private async maxKey(table: string, key: string): Promise<number> {
    const r = await this.sap.query<{ m: number | null }>(`SELECT MAX([${key}]) AS m FROM ${table}`);
    return r[0].m ?? 0;
  }

  // ---------- 문서 / 입금 / 분개 쓰기

  /** 문서 헤더+라인을 DocEntry 목록 기준으로 SAP에서 읽어 교체 */
  private async syncDocs(header: string, line: string, entries: number[]): Promise<number> {
    const ht = getTable(this.spec, header);
    const lt = getTable(this.spec, line);
    let n = 0;
    for (const chunk of chunks(entries, HEADER_CHUNK)) {
      const headers = await this.sap.query<Row>(`SELECT ${selectList(ht)} FROM ${header} WHERE DocEntry IN ${inList(chunk)}`);
      const lines = await this.sap.query<Row>(`SELECT ${selectList(lt)} FROM ${line} WHERE DocEntry IN ${inList(chunk)}`);
      await this.w.replaceDocs(ht.pg, lt.pg, "docentry", headers, lines);
      n += headers.length + lines.length;
    }
    return n;
  }

  /** 분개: 지정 TransId 중 대상 거래처(shortNames) 라인이 있는 분개만 헤더+라인 교체 */
  private async syncJournal(transIds: number[], shortNames: string[]): Promise<number> {
    const ht = getTable(this.spec, "OJDT");
    const lt = getTable(this.spec, "JDT1");
    let n = 0;
    for (const chunk of chunks(transIds, HEADER_CHUNK)) {
      const lines = await this.sap.query<Row>(
        `SELECT ${selectList(lt)} FROM JDT1 WHERE TransId IN ${inList(chunk)} AND ShortName IN ${inList(shortNames)}`
      );
      const ids = [...new Set(lines.map((l) => l.transid as number))];
      if (!ids.length) continue;
      const headers = await this.sap.query<Row>(`SELECT ${selectList(ht)} FROM OJDT WHERE TransId IN ${inList(ids)}`);
      await this.w.replaceDocs(ht.pg, lt.pg, "transid", headers, lines);
      n += headers.length + lines.length;
    }
    return n;
  }

  private async syncOrctForCustomer(cardcode: string): Promise<number> {
    const t = getTable(this.spec, "ORCT");
    const rows = await this.sap.query<Row>(`SELECT ${selectList(t)} FROM ORCT WHERE CardCode = @c`, [
      ["c", sql.NVarChar(50), cardcode],
    ]);
    await this.w.upsert(t.pg, rows);
    return rows.length;
  }

  // ---------- 마스터

  private async syncMastersFull(deleteMissing: boolean): Promise<number> {
    let n = 0;
    for (const [table, key] of PAGED_MASTERS) {
      const t = getTable(this.spec, table);
      const keys: string[] = [];
      let last = "";
      for (;;) {
        const rows = await this.sap.query<Row>(
          `SELECT TOP ${MASTER_PAGE} ${selectList(t)} FROM ${table} WHERE [${key}] > @last ORDER BY [${key}]`,
          [["last", sql.NVarChar(100), last]]
        );
        if (!rows.length) break;
        await this.w.upsert(t.pg, rows);
        n += rows.length;
        for (const r of rows) keys.push(String(r[key.toLowerCase()]));
        last = keys[keys.length - 1];
        log(`  ${table}: ${keys.length}건 진행`);
        if (rows.length < MASTER_PAGE) break;
      }
      if (deleteMissing && keys.length) {
        const removed = await this.w.deleteMissing(t.pg, key.toLowerCase(), keys);
        if (removed) log(`${table}: SAP에 없는 ${removed}건 정리`);
      }
      log(`${table}: ${keys.length}건`);
    }
    n += await this.syncSmallMasters(deleteMissing);
    return n;
  }

  private async syncSmallMasters(deleteMissing: boolean): Promise<number> {
    let n = 0;
    for (const table of SMALL_MASTERS) {
      const t = getTable(this.spec, table);
      const rows = await this.sap.query<Row>(`SELECT ${selectList(t)} FROM ${table}`);
      await this.w.upsert(t.pg, rows);
      if (deleteMissing && rows.length) {
        const key = t.pk[0].toLowerCase();
        await this.w.deleteMissing(t.pg, key, rows.map((r) => String(r[key])));
      }
      n += rows.length;
    }
    return n;
  }

  private async syncMastersChanged(since: string): Promise<number> {
    let n = 0;
    for (const [table] of PAGED_MASTERS) {
      const t = getTable(this.spec, table);
      const rows = await this.sap.query<Row>(`SELECT ${selectList(t)} FROM ${table} WHERE UpdateDate >= @since`, [
        ["since", sql.VarChar(8), ymd8(since)],
      ]);
      await this.w.upsert(t.pg, rows);
      n += rows.length;
      log(`${table}: 변경 ${rows.length}건`);
    }
    return n + (await this.syncSmallMasters(false));
  }

  // ---------- 초기 적재

  /** 증분 기준점을 적재 시작 전에 잡아 둔다(최초 1회). 적재 중 생긴 문서/변경은 다음 증분이 처리 */
  private async ensureWatermarks(today: string): Promise<void> {
    const targets: [string, string][] = [...DOC_FAMILIES.map(([h]) => [h, "DocEntry"] as [string, string]), ["ORCT", "DocEntry"], ["OJDT", "TransId"]];
    for (const [table, key] of targets) {
      if (await this.w.getState(table)) continue;
      await this.w.setState(table, { last_doc_entry: await this.maxKey(table, key) });
      for (const tier of Object.keys(TIER_DOC_DAYS)) await this.w.setState(`${table}@${tier}`, { last_update_date: today });
    }
    if (!(await this.w.getState("MASTERS@daily"))) await this.w.setState("MASTERS@daily", { last_update_date: today });
  }

  async loadedCustomers(): Promise<string[]> {
    return (await this.w.getCustomers()).filter((c) => c.loaded_at).map((c) => c.cardcode);
  }

  async init(opts: { customers?: string[]; tables?: string[] }): Promise<number> {
    const today = await this.sapToday();
    const elt = await this.eltCustomers();
    await this.w.syncCustomerRegistry(elt);
    await this.ensureWatermarks(today);
    const want = (name: string) => !opts.tables || opts.tables.includes(name);
    const done = await this.w.getProgress();
    let total = 0;

    if (want("MASTERS") && !done.has("MASTERS|*")) {
      log("마스터 전체 적재");
      const n = await this.syncMastersFull(false);
      await this.w.markProgress("MASTERS", "*", n);
      total += n;
    }

    const registry = await this.w.getCustomers();
    const loaded = new Set(registry.filter((c) => c.loaded_at).map((c) => c.cardcode));
    const customers = opts.customers ?? elt;
    for (const [i, c] of customers.entries()) {
      log(`거래처 ${c} (${i + 1}/${customers.length})`);
      for (const [header, line] of DOC_FAMILIES) {
        if (!want(header) || done.has(`${header}|${c}`)) continue;
        const entries = (
          await this.sap.query<{ e: number }>(`SELECT DocEntry AS e FROM ${header} WHERE CardCode = @c ORDER BY DocEntry`, [
            ["c", sql.NVarChar(50), c],
          ])
        ).map((r) => r.e);
        const n = await this.syncDocs(header, line, entries);
        await this.w.markProgress(header, c, n);
        total += n;
        log(`  ${header}/${line}: 문서 ${entries.length}건, 행 ${n}`);
      }
      if (want("ORCT") && !done.has(`ORCT|${c}`)) {
        const n = await this.syncOrctForCustomer(c);
        await this.w.markProgress("ORCT", c, n);
        total += n;
        log(`  ORCT: ${n}`);
      }
      if (want("JDT1") && !done.has(`JDT1|${c}`)) {
        const ids = (
          await this.sap.query<{ t: number }>("SELECT DISTINCT TransId AS t FROM JDT1 WHERE ShortName = @c", [["c", sql.NVarChar(50), c]])
        ).map((r) => r.t);
        // 한 분개에 여러 거래처 라인이 있을 수 있으므로 이미 적재된 거래처 라인도 함께 교체
        const n = await this.syncJournal(ids, [...loaded, c]);
        await this.w.markProgress("JDT1", c, n);
        total += n;
        log(`  OJDT/JDT1: 분개 ${ids.length}건, 행 ${n}`);
      }
      await this.w.markCustomerLoaded(c);
      loaded.add(c);
    }
    if (!opts.customers && !opts.tables) await this.w.setState("INIT@all", { initial_loaded_at: new Date().toISOString() });
    return total;
  }

  // ---------- 증분

  async incremental(tier: Tier): Promise<number> {
    const today = await this.sapToday();
    const elt = await this.eltCustomers();
    await this.w.syncCustomerRegistry(elt);
    const registry = await this.w.getCustomers();
    const loaded = registry.filter((c) => c.loaded_at).map((c) => c.cardcode);
    if (!loaded.length) {
      log("적재된 거래처가 없습니다. init을 먼저 실행하세요.");
      return 0;
    }
    const days = TIER_DOC_DAYS[tier];
    const from = days == null ? null : addDays(today, -days);
    const cards = inList(loaded);
    const sinceOf = async (name: string) => addDays((await this.w.getState(`${name}@${tier}`))?.last_update_date ?? addDays(today, -7), -1);
    const changedFilter = (dateCol: string) => `UpdateDate >= @since${from ? ` AND ${dateCol} >= @from` : ""}`;
    const dateInputs = (since: string): [string, sql.ISqlType, string][] => [
      ["since", sql.VarChar(8), ymd8(since)],
      ...(from ? [["from", sql.VarChar(8), ymd8(from)] as [string, sql.ISqlType, string]] : []),
    ];
    let total = 0;

    for (const [header, line] of DOC_FAMILIES) {
      const last = (await this.w.getState(header))?.last_doc_entry ?? 0;
      const max = await this.maxKey(header, "DocEntry");
      const since = await sinceOf(header);
      const fresh = await this.sap.query<{ e: number }>(
        `SELECT DocEntry AS e FROM ${header} WHERE DocEntry > @last AND DocEntry <= @max AND CardCode IN ${cards}`,
        [["last", sql.Int, last], ["max", sql.Int, max]]
      );
      const changed = await this.sap.query<{ e: number }>(
        `SELECT DocEntry AS e FROM ${header} WHERE ${changedFilter("DocDate")} AND CardCode IN ${cards}`,
        dateInputs(since)
      );
      const entries = [...new Set([...fresh, ...changed].map((r) => r.e))].sort((a, b) => a - b);
      const n = await this.syncDocs(header, line, entries);
      await this.w.setState(header, { last_doc_entry: max });
      await this.w.setState(`${header}@${tier}`, { last_update_date: today });
      total += n;
      log(`${header}/${line}: 신규 ${fresh.length}, 변경 ${changed.length}, 행 ${n}`);
    }

    {
      const last = (await this.w.getState("ORCT"))?.last_doc_entry ?? 0;
      const max = await this.maxKey("ORCT", "DocEntry");
      const since = await sinceOf("ORCT");
      const t = getTable(this.spec, "ORCT");
      const rows = await this.sap.query<Row>(
        `SELECT ${selectList(t)} FROM ORCT WHERE CardCode IN ${cards} AND ((DocEntry > @last AND DocEntry <= @max) OR (${changedFilter("DocDate")}))`,
        [["last", sql.Int, last], ["max", sql.Int, max], ...dateInputs(since)]
      );
      await this.w.upsert(t.pg, rows);
      await this.w.setState("ORCT", { last_doc_entry: max });
      await this.w.setState(`ORCT@${tier}`, { last_update_date: today });
      total += rows.length;
      log(`ORCT: ${rows.length}`);
    }

    {
      const last = (await this.w.getState("OJDT"))?.last_doc_entry ?? 0;
      const max = await this.maxKey("OJDT", "TransId");
      const since = await sinceOf("OJDT");
      const fresh = await this.sap.query<{ t: number }>(
        `SELECT DISTINCT TransId AS t FROM JDT1 WHERE TransId > @last AND TransId <= @max AND ShortName IN ${cards}`,
        [["last", sql.Int, last], ["max", sql.Int, max]]
      );
      const changed = await this.sap.query<{ t: number }>(`SELECT TransId AS t FROM OJDT WHERE ${changedFilter("RefDate")}`, dateInputs(since));
      const ids = [...new Set([...fresh, ...changed].map((r) => r.t))].sort((a, b) => a - b);
      const n = await this.syncJournal(ids, loaded);
      await this.w.setState("OJDT", { last_doc_entry: max });
      await this.w.setState(`OJDT@${tier}`, { last_update_date: today });
      total += n;
      log(`OJDT/JDT1: 신규 ${fresh.length}, 변경 후보 ${changed.length}, 행 ${n}`);
    }

    if (tier === "daily") {
      const since = addDays((await this.w.getState("MASTERS@daily"))?.last_update_date ?? addDays(today, -7), -1);
      total += await this.syncMastersChanged(since);
      await this.w.setState("MASTERS@daily", { last_update_date: today });
    } else if (tier === "weekly") {
      total += await this.syncMastersFull(true);
    }

    if (tier !== "hourly") {
      // 전체 초기 적재가 끝난 뒤에만 새로 ELT에 편입된 거래처를 자동 적재 (파일럿 단계에서 전체 적재가 시작되지 않도록)
      if ((await this.w.getState("INIT@all")) != null) {
        const pending = registry.filter((c) => c.elt && !c.loaded_at).map((c) => c.cardcode);
        if (pending.length) {
          log(`신규 ELT 거래처 적재: ${pending.slice(0, AUTO_INIT_PER_RUN).join(", ")}${pending.length > AUTO_INIT_PER_RUN ? " 외" : ""}`);
          total += await this.init({ customers: pending.slice(0, AUTO_INIT_PER_RUN) });
        }
      }
      await this.recon();
    }
    return total;
  }

  // ---------- 대사

  /**
   * 대사: 테이블별 월별 건수/금액을 SAP와 미러에서 비교.
   * 기본(매일/매주 자동): 최근 3개월만, 헤더 전기일자 인덱스 범위로 읽음 → SAP 부하 작음
   * full: 전체 기간. SAP에서 대량 디스크 읽기가 생기지 않도록 거래처 1곳씩 거래처코드 인덱스로 나눠 조회
   *       (183곳 전체 이력을 한 쿼리로 집계하면 SAP 디스크 4GB+ 읽기 발생 — 2026-10-27 측정)
   */
  async recon(opts: { full?: boolean } = {}): Promise<number> {
    const registry = await this.w.getCustomers();
    const loaded = registry.filter((c) => c.loaded_at).map((c) => c.cardcode);
    if (!loaded.length) return 0;
    const today = await this.sapToday();
    // 최근 3개월 = 전월의 전월 1일부터 (예: 10/27 → 08-01)
    const from = opts.full ? null : `${addDays(`${today.slice(0, 7)}-01`, -32).slice(0, 7)}-01`;
    const dateFilter = (col: string) => (from ? `AND ${col} >= @from` : "");
    type Check = {
      name: string;
      pg: string;
      sapSql: (cardFilter: string) => string;
      date: string;
      sum: string;
      sub?: string;
      headerPg?: string;
      cardCol: string;
    };
    const checks: Check[] = [];
    for (const [header, line] of DOC_FAMILIES) {
      checks.push({
        name: header,
        pg: getTable(this.spec, header).pg,
        sapSql: (cf) => `SELECT CONVERT(char(7), DocDate, 120) AS ym, COUNT(*) AS cnt, CONVERT(varchar(50), SUM(DocTotal)) AS total
                 FROM ${header} WHERE ${cf} ${dateFilter("DocDate")} GROUP BY CONVERT(char(7), DocDate, 120)`,
        date: "docdate",
        sum: "doctotal",
        cardCol: "CardCode",
      });
      checks.push({
        name: line,
        pg: getTable(this.spec, line).pg,
        headerPg: getTable(this.spec, header).pg,
        sapSql: (cf) => `SELECT CONVERT(char(7), h.DocDate, 120) AS ym, COUNT(*) AS cnt, CONVERT(varchar(50), SUM(l.LineTotal)) AS total
                 FROM ${line} l JOIN ${header} h ON h.DocEntry = l.DocEntry
                 WHERE ${cf} ${dateFilter("h.DocDate")} GROUP BY CONVERT(char(7), h.DocDate, 120)`,
        date: "docdate",
        sum: "linetotal",
        cardCol: "h.CardCode",
      });
    }
    checks.push({
      name: "ORCT",
      pg: "sap_orct",
      sapSql: (cf) => `SELECT CONVERT(char(7), DocDate, 120) AS ym, COUNT(*) AS cnt, CONVERT(varchar(50), SUM(DocTotal)) AS total
               FROM ORCT WHERE ${cf} ${dateFilter("DocDate")} GROUP BY CONVERT(char(7), DocDate, 120)`,
      date: "docdate",
      sum: "doctotal",
      cardCol: "CardCode",
    });
    checks.push({
      name: "JDT1",
      pg: "sap_jdt1",
      sapSql: (cf) => `SELECT CONVERT(char(7), RefDate, 120) AS ym, COUNT(*) AS cnt, CONVERT(varchar(50), SUM(Debit - Credit)) AS total
               FROM JDT1 WHERE ${cf} ${dateFilter("RefDate")} GROUP BY CONVERT(char(7), RefDate, 120)`,
      date: "refdate",
      sum: "debit",
      sub: "credit",
      cardCol: "ShortName",
    });

    log(opts.full ? `전체 기간 대사 (거래처 ${loaded.length}곳, 1곳씩 조회)` : `최근 대사 (${from} 이후)`);
    const thisMonth = today.slice(0, 7);
    const fromInput: [string, sql.ISqlType, string][] = from ? [["from", sql.VarChar(8), ymd8(from)]] : [];
    let mismatches = 0;
    for (const ch of checks) {
      const sapByMonth = new Map<string, { cnt: number; total: number }>();
      const addSap = (rows: { ym: string | null; cnt: number; total: string | null }[]) => {
        for (const r of rows) {
          const k = r.ym ?? "NULL";
          const m = sapByMonth.get(k) ?? { cnt: 0, total: 0 };
          m.cnt += r.cnt;
          m.total += Number(r.total ?? 0);
          sapByMonth.set(k, m);
        }
      };
      if (opts.full) {
        for (const c of loaded) {
          addSap(await this.sap.query(ch.sapSql(`${ch.cardCol} = @c`), [["c", sql.NVarChar(50), c]]));
        }
      } else {
        addSap(await this.sap.query(ch.sapSql(`${ch.cardCol} IN ${inList(loaded)}`), fromInput));
      }
      const sapRows = [...sapByMonth.entries()].map(([ym, m]) => ({ ym, cnt: m.cnt, total: String(m.total) }));
      // 미러 집계: 최근 대사는 1회, 전체 대사는 분기 단위로 나눠 호출
      // (Supabase API 8초 시간 제한 대응 — Micro 기준 판매오더 라인 1년 집계가 약 7초)
      const mirrorRows: { ym: string | null; cnt: number; total: string }[] = [];
      if (opts.full) {
        const years = [...sapByMonth.keys()].filter((k) => k !== "NULL").map((k) => Number(k.slice(0, 4)));
        const firstYear = years.length ? Math.min(...years) : Number(thisMonth.slice(0, 4));
        const pad = (m: number) => String(m).padStart(2, "0");
        for (let y = firstYear; y <= Number(thisMonth.slice(0, 4)); y++) {
          for (let q = 0; q < 4; q++) {
            const to = q === 3 ? `${y + 1}-01-01` : `${y}-${pad(q * 3 + 4)}-01`;
            mirrorRows.push(
              ...(await this.w.monthStats(ch.pg, ch.date, ch.sum, {
                subCol: ch.sub,
                from: `${y}-${pad(q * 3 + 1)}-01`,
                to,
                headerTable: ch.headerPg,
              }))
            );
          }
        }
      } else {
        mirrorRows.push(
          ...(await this.w.monthStats(ch.pg, ch.date, ch.sum, { subCol: ch.sub, from: from ?? undefined, headerTable: ch.headerPg }))
        );
      }
      const months = new Map<string, { sap_rows: number; mirror_rows: number; sap_sum: string; mirror_sum: string }>();
      for (const r of sapRows) months.set(r.ym ?? "NULL", { sap_rows: r.cnt, mirror_rows: 0, sap_sum: r.total ?? "0", mirror_sum: "0" });
      for (const r of mirrorRows) {
        const k = r.ym ?? "NULL";
        const m = months.get(k) ?? { sap_rows: 0, mirror_rows: 0, sap_sum: "0", mirror_sum: "0" };
        m.mirror_rows = Number(r.cnt);
        m.mirror_sum = String(r.total ?? "0");
        months.set(k, m);
      }
      const bad = [...months.entries()].filter(
        ([, m]) => m.sap_rows !== m.mirror_rows || Math.abs(Number(m.sap_sum) - Number(m.mirror_sum)) > 0.01
      );
      await this.w.saveRecon([...months.entries()].map(([ym, m]) => ({ table_name: ch.name, ym, ...m })));
      mismatches += bad.length;
      if (bad.length) {
        for (const [ym, m] of bad) {
          log(`대사 불일치 ${ch.name} ${ym}${ym === thisMonth ? "(당월, 동기화 이후 변경분일 수 있음)" : ""}: 건수 SAP ${m.sap_rows} / 미러 ${m.mirror_rows}, 금액 SAP ${m.sap_sum} / 미러 ${m.mirror_sum}`);
        }
      } else {
        log(`대사 일치 ${ch.name} (${months.size}개월)`);
      }
    }
    log(`대사 완료: 불일치 ${mismatches}건`);
    return mismatches;
  }
}

function parseArgs(argv: string[]) {
  const mode = argv[0] ?? "";
  const opt = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const list = (v?: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined);
  return { mode, customers: list(opt("customer")), tables: list(opt("tables")), force: argv.includes("--force") };
}

async function main() {
  const { mode, customers, tables, force } = parseArgs(process.argv.slice(2));
  if (!["init", "hourly", "daily", "weekly", "recon", "reload"].includes(mode)) {
    console.error("사용법: npx tsx scripts/sap-mirror/sync.ts <init|hourly|daily|weekly|recon|reload> [--customer C..] [--tables T..] [--force]");
    process.exit(1);
  }
  if (mode === "reload" && !tables) {
    console.error("reload는 --tables가 필요합니다. 예: --tables ODLN,ORCT");
    process.exit(1);
  }

  const w = new MirrorWriter();
  if (process.argv.includes("--clear-halt")) {
    await w.clearHalt();
    log("SAP 부하 정지(HALT) 해제");
  } else if (await w.isHalted()) {
    log("SAP 부하 감지로 정지(HALT)된 상태입니다. 원인 확인 후 --clear-halt 옵션으로 해제하세요.");
    process.exit(5);
  }
  if (!force && (await w.isLocked())) {
    log("다른 미러 동기화가 실행 중입니다. 건너뜁니다. (필요 시 --force)");
    process.exit(3);
  }
  const sap = new SapSource();
  const engine = new MirrorSync(loadSpec(), sap, w);
  const runId = await w.startRun(mode, tables?.join(",") ?? customers?.join(",") ?? null);
  const t0 = Date.now();
  let exitCode = 0;
  let finished = false;
  // 응답 없는 요청이 남은 채 이벤트 루프가 비면 Node가 조용히 종료(코드 0)되므로, 이를 실패로 기록하고 코드 1로 종료
  process.once("beforeExit", async () => {
    if (finished) return;
    log("비정상 종료: 응답 없이 끝난 요청이 있습니다. 실패로 기록합니다.");
    await w.finishRun(runId, "failed", w.rowsWritten, "비정상 종료 (응답 없이 끝난 요청)");
    process.exit(1);
  });
  try {
    let rows = 0;
    if (mode === "init") rows = await engine.init({ customers });
    else if (mode === "reload") {
      // --customer가 없으면 이미 적재된 거래처만 재적재 (미적재 거래처까지 적재가 번지지 않도록)
      const targets = customers ?? (await engine.loadedCustomers());
      for (const t of tables!) {
        if (t === "MASTERS") await w.clearProgress(t);
        else for (const c of targets) await w.clearProgress(t, c);
      }
      rows = await engine.init({ customers: targets, tables });
    } else if (mode === "recon") rows = await engine.recon({ full: process.argv.includes("--full") });
    else rows = await engine.incremental(mode as Tier);
    const summary = `완료: ${Math.round((Date.now() - t0) / 1000)}초, Supabase 기록 ${w.rowsWritten}행, SAP 쿼리 ${sap.queries}회(누적 ${Math.round(sap.queryMs / 1000)}초)`;
    log(summary);
    await w.finishRun(runId, "success", rows, summary);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof SapOverloadError) {
      exitCode = 4;
      log(`SAP 부하 감지로 중단: ${msg}`);
      await w.finishRun(runId, "sap_overload", w.rowsWritten, msg);
      await w.setHalt();
    } else if (e instanceof SapUnavailableError) {
      exitCode = 2;
      log(`SAP 접속 불가로 중단: ${msg}`);
      await w.finishRun(runId, "sap_unavailable", w.rowsWritten, msg);
    } else {
      exitCode = 1;
      log(`실패: ${msg}`);
      await w.finishRun(runId, "failed", w.rowsWritten, msg);
    }
  } finally {
    await sap.close();
  }
  finished = true;
  process.exit(exitCode);
}

main();
