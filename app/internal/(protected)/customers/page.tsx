import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { CustomersPageClient } from "./CustomersPageClient";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/internal/login");

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("customer")
    .select("cardcode, useyn, sido, sigun, cardname, address, phone1, phone2, cntctprsn, repname")
    .order("cardname");

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-600">거래처 데이터를 불러오는 중 오류가 발생했습니다: {error.message}</p>
      </div>
    );
  }

  return <CustomersPageClient initialRows={data ?? []} />;
}
