import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { serverErrorResponse } from "@/lib/api-error";

/** 거래처 검색 (자동완성). GET /api/customers?q=검색어 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";

    const admin = getSupabaseAdmin();
    let query = admin.from("rpt_customer").select("cardcode, cardname").eq("useyn", "Y").order("cardname");

    if (q.length > 0) {
      query = query.or(`cardcode.ilike.%${q}%,cardname.ilike.%${q}%`);
    }

    const { data, error } = await query.limit(50);

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    return serverErrorResponse(e, "api/customers", "거래처 목록을 불러오지 못했어요.");
  }
}
