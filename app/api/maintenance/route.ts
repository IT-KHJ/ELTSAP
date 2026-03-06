import { NextRequest, NextResponse } from "next/server";
import { getMaintenanceInfo, saveMaintenanceInfo } from "@/lib/maintenance-metadata";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** GET: 점검 정보 조회 (공개) */
export async function GET() {
  try {
    const info = await getMaintenanceInfo();
    return NextResponse.json({
      content: info?.content ?? null,
      time_from: info?.time_from ?? null,
      time_to: info?.time_to ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "점검 정보 조회 중 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH: 점검 정보 저장 (관리자 전용) */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    const isAdmin =
      user.user_metadata?.role === "admin" ||
      user.app_metadata?.role === "admin" ||
      (process.env.ADMIN_EMAILS &&
        user.email &&
        process.env.ADMIN_EMAILS.split(",")
          .map((e) => e.trim())
          .includes(user.email));
    if (!isAdmin) {
      return NextResponse.json({ error: "관리자만 수정할 수 있습니다." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const content = body.content !== undefined ? (body.content ?? null) : undefined;
    const time_from = body.time_from !== undefined ? (body.time_from ?? null) : undefined;
    const time_to = body.time_to !== undefined ? (body.time_to ?? null) : undefined;

    await saveMaintenanceInfo({ content, time_from, time_to });
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "점검 정보 저장 중 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
