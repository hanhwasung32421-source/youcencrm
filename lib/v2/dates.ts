// 날짜는 전부 한국 시간(KST, UTC+9) 기준 달력 날짜('YYYY-MM-DD')로 다룬다.
// 서버(Vercel, UTC)와 브라우저(KST)가 같은 "오늘"을 보게 하려는 목적.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const

export function kstYmd(date: Date = new Date()): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

export function kstDayStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+09:00`)
}

export function kstDayEnd(ymd: string): Date {
  return new Date(kstDayStart(ymd).getTime() + DAY_MS)
}

export function addDays(ymd: string, days: number): string {
  return kstYmd(new Date(kstDayStart(ymd).getTime() + days * DAY_MS))
}

// 달력 날짜의 요일(0=일 ... 6=토). 타임존과 무관하게 날짜 자체의 요일을 구한다.
export function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay()
}

export function weekStartMonday(ymd: string): string {
  const diff = (weekdayOf(ymd) + 6) % 7
  return addDays(ymd, -diff)
}

export function monthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`
}

export function addMonths(ymd: string, months: number): string {
  const [y, m] = ymd.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}-01`
}

export function daysInMonth(ymd: string): number {
  const [y, m] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function formatKstTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' })
}

// 'MM/DD HH:mm' (KST)
export function formatKstDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const ymd = kstYmd(d)
  return `${ymd.slice(5, 7)}/${ymd.slice(8, 10)} ${formatKstTime(iso)}`
}

export function formatKstDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return kstYmd(d)
}

// 'M월 D일 (요일)'
export function formatYmdLabel(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number)
  return `${m}월 ${d}일 (${WEEKDAY_LABELS[weekdayOf(ymd)]})`
}

// datetime-local 입력값 <-> ISO. 입력값은 브라우저 타임존과 무관하게 KST로 해석한다.
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${kstYmd(d)}T${formatKstTime(iso)}`
}

export function localInputToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(`${value}:00+09:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// 오늘 KST 기준 특정 시각의 ISO (기본 마감 시각 등에 사용)
export function todayAtKst(hour: number, minute = 0): string {
  const ymd = kstYmd()
  return new Date(`${ymd}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`).toISOString()
}

// 오늘(또는 endYmd)까지 최근 n일의 달력 날짜 목록 (오름차순)
export function lastNDays(n: number, endYmd: string = kstYmd()): string[] {
  const days: string[] = []
  for (let i = n - 1; i >= 0; i -= 1) days.push(addDays(endYmd, -i))
  return days
}
