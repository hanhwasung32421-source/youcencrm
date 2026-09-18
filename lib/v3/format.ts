const krw = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('ko-KR')

export function formatKrw(value: number | null | undefined): string {
  const n = Number(value || 0)
  const sign = n < 0 ? '-' : ''
  return `${sign}₩${krw.format(Math.abs(Math.round(n)))}`
}

// 대시보드 KPI처럼 공간이 좁을 때: ₩1,234만 / ₩1.2억
export function formatKrwCompact(value: number | null | undefined): string {
  const n = Number(value || 0)
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 100_000_000) return `${sign}₩${(abs / 100_000_000).toFixed(abs >= 1_000_000_000 ? 0 : 1)}억`
  if (abs >= 10_000) return `${sign}₩${krw.format(Math.round(abs / 10_000))}만`
  return `${sign}₩${krw.format(abs)}`
}

export function formatNumber(value: number | null | undefined): string {
  return num.format(Number(value || 0))
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toFixed(digits)}%`
}

export function formatSignedPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return value.slice(0, 10)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}
