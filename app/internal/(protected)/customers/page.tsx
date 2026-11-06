import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { CustomersPageClient } from "./CustomersPageClient";
import { retryMessage } from "@/lib/user-error";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/internal/login");

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("rpt_customer")
    .select("cardcode, useyn, sido, sigun, cardname, address, phone1, phone2, cntctprsn, repname")
    .order("cardname");

  if (error) {
    console.error("[customers] 거래처 조회 실패:", error);
    return (
      <div className="p-6">
        <p className="text-gray-700 whitespace-pre-line">{retryMessage("거래처 목록을 불러오지 못했어요.")}</p>
      </div>
    );
  }

  return <CustomersPageClient initialRows={data ?? []} />;
}
