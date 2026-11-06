import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { serverErrorResponse } from "@/lib/api-error";

function isAdminUser(user: { email?: string | null; user_metadata?: unknown; app_metadata?: unknown } | null): boolean {
  if (!user) return false;
  return Boolean(
    (user.user_metadata as { role?: string } | null)?.role === "admin" ||
    (user.app_metadata as { role?: string } | null)?.role === "admin" ||
    (process.env.ADMIN_EMAILS &&
      user.email &&
      process.env.ADMIN_EMAILS.split(",")
        .map((e) => e.trim())
        .includes(user.email))
  );
}

/** GET /api/customers/manage — 거래처 관리 화면 전용 전체 조회 (useyn 무관). 목록·거래처 정보는 SAP 거래처(rpt_customer) 기준 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요해요. 다시 로그인하세요." }, { status: 401 });
    if (!isAdminUser(user)) return NextResponse.json({ error: "관리자만 볼 수 있는 화면이에요." }, { status: 403 });

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("rpt_customer")
      .select("cardcode, useyn, sido, sigun, cardname, address, phone1, phone2, cntctprsn, repname")
      .order("cardname");

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    return serverErrorResponse(e, "api/customers/manage", "거래처 목록을 불러오지 못했어요.");
  }
}

/** 앱에서 관리하는 값만 수정 가능. 거래처명/주소/전화 등은 SAP 값을 표시만 함 */
const EDITABLE_FIELDS = ["useyn", "sido", "sigun"] as const;
type EditableField = typeof EDITABLE_FIELDS[number];

/** PATCH /api/customers/manage — 단일 거래처 수정 (cardcode는 수정 불가). customer 행이 없는 새 거래처는 행을 만들어 저장 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요해요. 다시 로그인하세요." }, { status: 401 });
    if (!isAdminUser(user)) return NextResponse.json({ error: "관리자만 수정할 수 있어요." }, { status: 403 });

    const body = await request.json() as Record<string, unknown>;
    const cardcode = body.cardcode;
    if (!cardcode || typeof cardcode !== "string") {
      return NextResponse.json({ error: "거래처를 선택하세요." }, { status: 400 });
    }

    const updates: Partial<Record<EditableField, string | null>> = {};
    for (const field of EDITABLE_FIELDS) {
      if (field in body) {
        const val = body[field];
        updates[field] = val === null || val === undefined ? null : String(val);
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "저장할 변경 내용이 없어요." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("customer")
      .upsert({ cardcode, ...updates }, { onConflict: "cardcode" });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverErrorResponse(e, "api/customers/manage", "거래처 정보를 저장하지 못했어요.");
  }
}

/** PUT /api/customers/manage — 여러 거래처 일괄 수정. body: { rows: [{ cardcode, useyn, sido, sigun }] }. 한 번의 upsert로 저장 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요해요. 다시 로그인하세요." }, { status: 401 });
    if (!isAdminUser(user)) return NextResponse.json({ error: "관리자만 수정할 수 있어요." }, { status: 403 });

    const body = await request.json() as { rows?: unknown };
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ error: "저장할 변경 내용이 없어요." }, { status: 400 });
    }

    const records: ({ cardcode: string } & Record<EditableField, string | null>)[] = [];
    for (const item of body.rows as Record<string, unknown>[]) {
      const cardcode = item?.cardcode;
      if (!cardcode || typeof cardcode !== "string") {
        return NextResponse.json({ error: "거래처를 선택하세요." }, { status: 400 });
      }
      // 모든 행이 같은 컬럼을 갖도록 3개 필드를 항상 채움
      const record = { cardcode } as { cardcode: string } & Record<EditableField, string | null>;
      for (const field of EDITABLE_FIELDS) {
        const val = item[field];
        record[field] = val === null || val === undefined ? null : String(val);
      }
      records.push(record);
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("customer")
      .upsert(records, { onConflict: "cardcode" });

    if (error) throw error;
    return NextResponse.json({ ok: true, count: records.length });
  } catch (e) {
    return serverErrorResponse(e, "api/customers/manage", "거래처 정보를 저장하지 못했어요.");
  }
}
