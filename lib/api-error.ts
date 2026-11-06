import { NextResponse } from "next/server";
import { UserMessageError, TIMEOUT_MESSAGE, retryMessage } from "./user-error";

/**
 * API 처리 중 예상하지 못한 오류 응답 — 원문은 서버 로그에만, 사용자에게는 안내 문구만 보낸다.
 * @param what 사용자 안내 첫 문장 (예: "보고서를 불러오지 못했어요.")
 */
export function serverErrorResponse(e: unknown, context: string, what: string) {
  console.error(`[${context}]`, e);
  let message = retryMessage(what);
  if (e instanceof UserMessageError) message = e.message;
  else if (e instanceof Error && /statement timeout|canceling statement/i.test(e.message)) message = TIMEOUT_MESSAGE;
  return NextResponse.json({ error: message }, { status: 500 });
}
