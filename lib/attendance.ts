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

export function getAutoCheckoutIso(ymd: string) {
  return getKstIsoAtTime(ymd, 23, 59, 0)
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
