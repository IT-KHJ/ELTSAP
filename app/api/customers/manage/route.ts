import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";

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

/** GET /api/customers/manage — 거래처 관리 화면 전용 전체 조회 (useyn 무관) */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    if (!isAdminUser(user)) return NextResponse.json({ error: "관리자만 조회할 수 있습니다." }, { status: 403 });

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("customer")
      .select("cardcode, useyn, sido, sigun, cardname, address, phone1, phone2, cntctprsn, repname")
      .order("cardname");

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    const message = e instanceof Error ? e.message : "거래처 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const EDITABLE_FIELDS = ["useyn", "sido", "sigun", "cardname", "address", "phone1", "phone2", "cntctprsn", "repname"] as const;
type EditableField = typeof EDITABLE_FIELDS[number];

/** PATCH /api/customers/manage — 단일 거래처 수정 (cardcode는 수정 불가) */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    if (!isAdminUser(user)) return NextResponse.json({ error: "관리자만 수정할 수 있습니다." }, { status: 403 });

    const body = await request.json() as Record<string, unknown>;
    const cardcode = body.cardcode;
    if (!cardcode || typeof cardcode !== "string") {
      return NextResponse.json({ error: "cardcode가 필요합니다." }, { status: 400 });
    }

    const updates: Partial<Record<EditableField, string | null>> = {};
    for (const field of EDITABLE_FIELDS) {
      if (field in body) {
        const val = body[field];
        updates[field] = val === null || val === undefined ? null : String(val);
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "수정할 필드가 없습니다." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("customer")
      .update(updates)
      .eq("cardcode", cardcode);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "거래처 수정 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
