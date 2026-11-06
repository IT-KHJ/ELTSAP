/**
 * 사용자 안내용 오류 문구 (서버·화면 공용, 2026-11-06 사용자 결정)
 * - 사용자에게는 시스템 오류 원문·코드·영어 메시지를 보여 주지 않고, 상황과 할 일만 부드럽게 안내한다.
 * - 말투: 사용자가 직접 해야 하는 일은 "~하세요", 기다려 달라는 부탁은 "기다려 주세요", 상황 설명은 "~요".
 * - 오류 원문은 서버 로그(console.error)에만 남긴다.
 */

/** 이 오류의 message는 사용자에게 그대로 보여 줘도 되는 안내 문구 */
export class UserMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserMessageError";
  }
}

/** "무엇을 하지 못했어요" + 다시 시도 안내 */
export function retryMessage(what: string): string {
  return `${what}\n잠시 후 다시 시도하세요. 문제가 계속되면 관리자에게 문의하세요.`;
}

export const NETWORK_MESSAGE = "서버와 연결이 원활하지 않아요.\n인터넷 연결을 확인한 뒤 다시 시도하세요.";
export const TIMEOUT_MESSAGE = "조회할 자료가 많아 시간이 오래 걸리고 있어요.\n조회 기간을 줄여서 다시 조회하세요.";

/** API 응답에서 안내 문구({ error })만 꺼낸다. 없거나 형식이 다르면 fallback */
export async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.clone().json();
    const msg = body && typeof body.error === "string" ? body.error.trim() : "";
    if (msg) return msg;
  } catch {
    // JSON이 아닌 응답(HTML 등)은 무시
  }
  return fallback;
}

/** 화면에서 잡은 오류를 사용자 안내 문구로 바꾼다 (원문은 콘솔에만) */
export function toUserMessage(e: unknown, fallback: string): string {
  if (e instanceof UserMessageError) return e.message;
  console.error(e);
  if (e instanceof TypeError && /fetch|network|load failed/i.test(e.message)) return NETWORK_MESSAGE;
  return fallback;
}
