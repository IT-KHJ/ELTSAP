/**
 * 숫자/증감 포맷 (천 단위 콤마, 소수 1자리, 증감 ▲▼ 색상 규칙)
 */

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return Math.round(value).toLocaleString("ko-KR");
}

export function formatAmount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return Math.round(value).toLocaleString("ko-KR");
}

/**
 * 증감률. previous === 0 이면 "-" 반환 (100% 처리 안 함). 소수 1자리.
 * 매출 등(기본): 전년(previous)이 음수일 때 (current-previous)/|previous| 로 계산해 %와 ▲/▼가 일치
 *   (예: -324만→468만원 → 양의 %, ▲).
 * 반품(returns): invertForNegative=false 이면 기존 (current-previous)/previous 유지.
 */
export function formatChangePercent(
  current: number,
  previous: number,
  options?: { invertForNegative?: boolean }
): { text: string; isIncrease: boolean | null } {
  if (previous === 0 || !Number.isFinite(previous) || !Number.isFinite(current)) {
    return { text: "-", isIncrease: null };
  }
  const useAbsDenom = previous < 0 && options?.invertForNegative !== false;
  const pct = useAbsDenom
    ? ((current - previous) / Math.abs(previous)) * 100
    : ((current - previous) / previous) * 100;
  if (!Number.isFinite(pct)) return { text: "-", isIncrease: null };
  const text = `${pct.toFixed(1)}%`;
  const isIncrease: boolean | null = pct > 0 ? true : pct < 0 ? false : null;
  return { text, isIncrease };
}

export function formatChangePercentText(current: number, previous: number): string {
  return formatChangePercent(current, previous).text;
}
