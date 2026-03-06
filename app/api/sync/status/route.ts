import { NextResponse } from "next/server";
import { isSapSqlServerConfigured } from "@/lib/sap-sqlserver";

/** GET: 현재 동기화 소스 확인 (SAP SQL Server 직접 연결 vs SYNC_*_URL) */
export async function GET() {
  const sapSqlServerConfigured = isSapSqlServerConfigured();
  return NextResponse.json({
    sapSqlServerConfigured,
    mode: sapSqlServerConfigured ? "SAP SQL Server 직접 연결" : "SYNC_*_URL (외부 API)",
  });
}
