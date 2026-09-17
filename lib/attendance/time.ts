export function getKstYmd(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return formatter.format(date)
}

export function getKstIsoAtTime(ymd: string, hour: number, minute: number, second = 0) {
  const [year, month, day] = ymd.split('-').map(Number)
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute, second) - 9 * 60 * 60 * 1000
  return new Date(utcMillis).toISOString()
}

export function isValidYmd(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

// KST 기준 하루의 시작(00:00:00.000)을 UTC ISO로.
export function getKstDayStartIso(ymd: string) {
  return getKstIsoAtTime(ymd, 0, 0, 0)
}

// KST 기준 하루의 끝(23:59:59.999)을 UTC ISO로. created_at 범위 조회에서
// .lte(endIso) 가 그 날짜의 마지막 순간까지 포함하도록 쓴다.
export function getKstDayEndIso(ymd: string) {
  const [year, month, day] = ymd.split('-').map(Number)
  const nextDayStartUtcMillis = Date.UTC(year, month - 1, day + 1, 0, 0, 0) - 9 * 60 * 60 * 1000
  return new Date(nextDayStartUtcMillis - 1).toISOString()
}

// year/month/day/weekday를 한 번에 뽑아야 할 때(주/월 경계 계산 등) 쓰는 버전.
// getKstYmd()는 문자열만 필요할 때 계속 쓰면 된다.
export function getKstDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  const y = Number(parts.year)
  const m = Number(parts.month)
  const d = Number(parts.day)
  return { y, m, d, ymd: `${parts.year}-${parts.month}-${parts.day}`, weekday: String(parts.weekday || '') }
}

// 오늘(ymd) 기준 월~일 전체 한 주의 경계. getAttendancePeriodRange('week')는
// "이번 주 시작~오늘까지(week-to-date)"를 돌려주는 반면, 이건 미래 요일까지
// 포함한 달력상 한 주 전체(월~일)가 필요한 기간 집계용이라 별도로 둔다.
export function getFullWeekRangeKst(todayYmd: string) {
  const weekdayShort = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(
    new Date(`${todayYmd}T12:00:00Z`)
  )
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const dow = map[weekdayShort] ?? 0
  const diffToMon = (dow + 6) % 7
  const start = addDaysToYmd(todayYmd, -diffToMon)
  const end = addDaysToYmd(start, 6)
  return { start, end }
}

export function getMonthRangeKst(y: number, m: number) {
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export function getAutoCheckoutIso(ymd: string) {
  return getKstIsoAtTime(ymd, 23, 59, 0)
}

export function getLateThresholdIso(ymd: string) {
  return getKstIsoAtTime(ymd, 10, 5, 0)
}

export function isLateCheckIn(checkInAt: string | null, workDate: string) {
  if (!checkInAt) return false
  return new Date(checkInAt).getTime() > new Date(getLateThresholdIso(workDate)).getTime()
}

export function getAttendanceDisplayStatus(day?: {
  work_date?: string | null
  attendance_status?: string | null
  check_in_at?: string | null
  check_out_at?: string | null
}) {
  if (!day?.attendance_status || day.attendance_status === 'not_started') return '미입력'
  if (day.attendance_status === 'vacation') return '휴가'
  if (day.attendance_status === 'early_leave') return '조퇴'
  if (isLateCheckIn(day.check_in_at || null, day.work_date || '')) return '지각'
  if (day.check_out_at) return '퇴근'
  if (day.check_in_at) return '출근'
  return '미입력'
}

export function addDaysToYmd(ymd: string, days: number) {
  const [year, month, day] = ymd.split('-').map(Number)
  const base = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  base.setUTCDate(base.getUTCDate() + days)
  return getKstYmd(base)
}

export function getAttendanceWorkedSeconds(checkInAt: string | null, checkOutAt: string | null, now = new Date()) {
  if (!checkInAt) return 0
  const start = new Date(checkInAt)
  const end = checkOutAt ? new Date(checkOutAt) : now
  const diff = Math.floor((end.getTime() - start.getTime()) / 1000)
  return Math.max(diff, 0)
}

export function formatWorkedHms(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}시 ${minutes}분 ${seconds}초`
}

export function getAttendancePeriodRange(period: 'day' | 'week' | 'month') {
  const todayYmd = getKstYmd(new Date())
  const [year, month, day] = todayYmd.split('-').map(Number)
  const noonUtc = Date.UTC(year, month - 1, day, 12, 0, 0) - 9 * 60 * 60 * 1000
  const today = new Date(noonUtc)
  const weekDay = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(today).replace(
      /Sun|Mon|Tue|Wed|Thu|Fri|Sat/,
      (match) => ({ Sun: '0', Mon: '1', Tue: '2', Wed: '3', Thu: '4', Fri: '5', Sat: '6' }[match] || '0')
    )
  )
  const start = new Date(today)
  if (period === 'week') {
    start.setUTCDate(start.getUTCDate() - ((weekDay + 6) % 7))
  }
  if (period === 'month') {
    start.setUTCDate(1)
  }
  return {
    startYmd: getKstYmd(start),
    endYmd: todayYmd
  }
}

export function getYmdList(startYmd: string, endYmd: string) {
  const result: string[] = []
  let current = startYmd
  while (current <= endYmd) {
    result.push(current)
    current = addDaysToYmd(current, 1)
  }
  return result
}

export function getWeekdayLabel(ymd: string) {
  const [year, month, day] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(date)
}

export function getMonthDayNumbers(endYmd: string) {
  const [year, month] = endYmd.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Array.from({ length: lastDay }, (_, index) => index + 1)
}
