import { NextRequest, NextResponse } from "next/server";
import { searchLedgerCustomers } from "@/lib/ledger-queries";

/** 거래원장 거래처 검색 (자동완성). GET /api/ledger/customers?q=검색어 — 미러 적재 완료된 ELT 거래처만 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    return NextResponse.json(await searchLedgerCustomers(q));
  } catch (e) {
    const message = e instanceof Error ? e.message : "거래처 목록 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
