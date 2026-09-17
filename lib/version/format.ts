import { getKstIsoAtTime, getKstYmd, getWeekdayLabel } from '@/lib/attendance/time'

// 오전 7시를 기준으로 "오늘"로 넘어간다. 그 전까지는 어제 빌드된 값을 그대로 보여준다.
const DAILY_RESET_HOUR = 7

export function formatVersionLabel(ymd: string, n: number) {
  const [year, month, day] = ymd.split('-').map(Number)
  const weekday = getWeekdayLabel(ymd)
  return `${year}년 ${month}월 ${day}일 (${weekday}) - ${n}`
}

export function parseVersionLabel(raw: string): { ymd: string; n: number } | null {
  const match = raw.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*\([^)]*\)\s*-\s*(\d+)$/)
  if (!match) return null
  const [, year, month, day, n] = match
  const ymd = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  return { ymd, n: Number(n) }
}

/**
 * 빌드 시 고정된 버전 문자열을 화면에 표시할 때 쓰는 값으로 보정한다.
 * - 오늘 날짜로 빌드된 값이면 그대로 보여준다 (푸시가 있었던 날).
 * - 아직 오늘 빌드가 없고, 오전 7시가 지났으면 "오늘 날짜 - 1"을 보여준다 (푸시 없이도 갱신).
 * - 오전 7시 전이면 어제 빌드된 값을 그대로 보여준다.
 */
export function getDisplayVersion(bakedVersion: string, now: Date = new Date()) {
  const parsed = parseVersionLabel(bakedVersion)
  if (!parsed) return bakedVersion

  const todayYmd = getKstYmd(now)
  if (parsed.ymd === todayYmd) return bakedVersion

  const resetAt = new Date(getKstIsoAtTime(todayYmd, DAILY_RESET_HOUR, 0)).getTime()
  if (now.getTime() < resetAt) return bakedVersion

  return formatVersionLabel(todayYmd, 1)
}
