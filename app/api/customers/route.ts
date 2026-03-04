import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** 거래처 검색 (자동완성). GET /api/customers?q=검색어 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";

    const admin = getSupabaseAdmin();
    let query = admin.from("CUSTOMER").select("cardcode, cardname").order("cardname");

    if (q.length > 0) {
      query = query.or(`cardcode.ilike.%${q}%,cardname.ilike.%${q}%`);
    }

    const { data, error } = await query.limit(50);

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    const message = e instanceof Error ? e.message : "거래처 목록 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
