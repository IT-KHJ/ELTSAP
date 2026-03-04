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
 */
export function formatChangePercent(
  current: number,
  previous: number
): { text: string; isIncrease: boolean | null } {
  if (previous === 0 || !Number.isFinite(previous) || !Number.isFinite(current)) {
    return { text: "-", isIncrease: null };
  }
  const pct = ((current - previous) / previous) * 100;
  if (!Number.isFinite(pct)) return { text: "-", isIncrease: null };
  const text = `${pct >= 0 ? "" : ""}${pct.toFixed(1)}%`;
  return { text, isIncrease: pct > 0 ? true : pct < 0 ? false : null };
}

export function formatChangePercentText(current: number, previous: number): string {
  return formatChangePercent(current, previous).text;
}
