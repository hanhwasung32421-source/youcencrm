// 표시용 포맷 도우미(클라이언트/서버 공용).

const krw = new Intl.NumberFormat('ko-KR')

export function formatKrw(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return `₩${krw.format(Math.round(value))}`
}

// 대시보드 KPI처럼 자리가 좁은 곳에서 "1.2억", "3,500만"으로 줄여 쓴다.
export function formatKrwCompact(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  const abs = Math.abs(value)
  if (abs >= 100_000_000) return `${(value / 100_000_000).toFixed(abs >= 1_000_000_000 ? 0 : 1).replace(/\.0$/, '')}억`
  if (abs >= 10_000) return `${krw.format(Math.round(value / 10_000))}만`
  return krw.format(Math.round(value))
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return krw.format(value)
}

export function toYmd(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayYmd() {
  return toYmd(new Date())
}

export function addDays(ymd: string, days: number) {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return toYmd(date)
}

// 두 날짜(YYYY-MM-DD) 사이 일수. b - a.
export function diffDays(a: string, b: string) {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const ta = Date.UTC(ay, am - 1, ad)
  const tb = Date.UTC(by, bm - 1, bd)
  return Math.round((tb - ta) / 86_400_000)
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  // 날짜만(YYYY-MM-DD)인 경우 그대로, timestamptz면 로컬 날짜로
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return toYmd(date)
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${toYmd(date)} ${hh}:${mm}`
}

export function formatShortDate(ymd: string) {
  const [, m, d] = ymd.split('-').map(Number)
  return `${m}/${d}`
}

// datetime-local input 값(YYYY-MM-DDTHH:mm)으로 변환
export function toDateTimeLocal(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${toYmd(date)}T${hh}:${mm}`
}
