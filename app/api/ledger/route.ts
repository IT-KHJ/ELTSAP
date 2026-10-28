import { NextRequest, NextResponse } from "next/server";
import { getLedger } from "@/lib/ledger-queries";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** GET: 거래처 거래원장. cardcode, start, end (YYYY-MM-DD). SAP 원본 미러(sap_*) 기반 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cardcode = searchParams.get("cardcode")?.trim();
    const start = searchParams.get("start")?.trim();
    const end = searchParams.get("end")?.trim();

    if (!cardcode || !start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
      return NextResponse.json(
        { error: "cardcode, start, end 파라미터가 필요합니다. (YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    if (start > end) {
      return NextResponse.json({ error: "시작일이 종료일보다 늦습니다." }, { status: 400 });
    }

    const result = await getLedger(cardcode, start, end);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
