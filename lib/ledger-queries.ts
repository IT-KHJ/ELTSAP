/**
 * 거래처 거래원장 조회 (SAP 원본 미러 sap_* + rpt_ledger 함수 기반, 기존 동기화 테이블과 독립).
 * 업무 규칙(행 구성/입금·채권조정 구분/잔액 계산)은 supabase/migrations/027_add_rpt_ledger.sql 참조.
 */

import { getSupabaseAdminNoCache } from "@/lib/supabase";
import type { LedgerCustomerOption, LedgerResponse, LedgerRow } from "@/types/ledger";

const num = (v: unknown): number => (v == null || v === "" ? 0 : Number(v));

export async function getLedger(cardcode: string, startDate: string, endDate: string): Promise<LedgerResponse> {
  const admin = getSupabaseAdminNoCache();

  const { data: cust } = await admin.from("sap_ocrd").select("cardname").eq("cardcode", cardcode).maybeSingle();
  const cardname = (cust as { cardname?: string } | null)?.cardname ?? cardcode;

  // 1회 호출로 전체 행(JSON 배열)을 받음 — 행 단위 RPC는 API 1,000행 제한으로 나눠 부를 때마다 원장을 재계산함
  const { data, error } = await admin.rpc("rpt_ledger_json", { p_cardcode: cardcode, p_start: startDate, p_end: endDate });
  if (error) throw new Error(`거래원장 조회 실패: ${error.message}`);
  const rows: LedgerRow[] = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    seq: num(r.seq),
    txdate: (r.txdate as string | null) ?? null,
    docnum: r.docnum == null ? null : num(r.docnum),
    gubun: String(r.gubun ?? ""),
    descr: (r.descr as string | null) ?? null,
    qty: r.qty == null ? null : num(r.qty),
    occur: num(r.occur),
    cancel: num(r.cancel),
    collect: num(r.collect),
    balance: num(r.balance),
    remark: (r.remark as string | null) ?? null,
  }));

  const opening = rows.find((r) => r.seq === 0)?.balance ?? 0;
  const body = rows.filter((r) => r.seq > 0);
  const totals = {
    opening,
    occur: body.reduce((s, r) => s + r.occur, 0),
    cancel: body.reduce((s, r) => s + r.cancel, 0),
    collect: body.reduce((s, r) => s + r.collect, 0),
    closing: body.length ? body[body.length - 1].balance : opening,
  };

  return { cardcode, cardname, startDate, endDate, rows, totals };
}

/** 거래원장 거래처 검색: 미러 초기 적재가 끝난 ELT 거래처만 */
export async function searchLedgerCustomers(q: string): Promise<LedgerCustomerOption[]> {
  const admin = getSupabaseAdminNoCache();
  const { data: loaded, error: e1 } = await admin
    .from("sap_mirror_customers")
    .select("cardcode")
    .not("loaded_at", "is", null);
  if (e1) throw new Error(e1.message);
  const codes = ((loaded ?? []) as { cardcode: string }[]).map((r) => r.cardcode);
  if (!codes.length) return [];

  let query = admin.from("sap_ocrd").select("cardcode, cardname").in("cardcode", codes).order("cardname");
  const term = q.trim().replace(/[%,()]/g, "");
  if (term) query = query.or(`cardcode.ilike.%${term}%,cardname.ilike.%${term}%`);
  const { data, error } = await query.limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as LedgerCustomerOption[];
}
