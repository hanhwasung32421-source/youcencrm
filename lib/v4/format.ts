// 클라이언트/서버 공용 포맷 유틸 (React 의존 없음).

export function fmtNumber(value: number | null | undefined) {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString('ko-KR')
}

export function fmtCompact(value: number | null | undefined) {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return '0'
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}만`
  return Math.round(n).toLocaleString('ko-KR')
}

export function fmtPercent(ratio: number | null | undefined, digits = 2) {
  const n = Number(ratio || 0)
  if (!Number.isFinite(n)) return '0%'
  return `${(n * 100).toFixed(digits)}%`
}

export function fmtSignedPercent(ratio: number | null | undefined, digits = 0) {
  const n = Number(ratio || 0)
  if (!Number.isFinite(n)) return '0%'
  const sign = n > 0 ? '+' : ''
  return `${sign}${(n * 100).toFixed(digits)}%`
}

export function fmtDateTimeKst(iso: string | null | undefined) {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

export function fmtDateKst(iso: string | null | undefined) {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date)
    .replace(/\.\s?/g, '.')
    .replace(/\.$/, '')
}

export function fmtRelative(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return '-'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '-'
  const diffSec = Math.max(0, Math.floor((now - t) / 1000))
  if (diffSec < 60) return '방금 전'
  const min = Math.floor(diffSec / 60)
  if (min < 60) return `${min}분 전`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}시간 전`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day}일 전`
  const month = Math.floor(day / 30)
  if (month < 12) return `${month}개월 전`
  return `${Math.floor(month / 12)}년 전`
}

export function shortYmd(ymd: string) {
  const [, m, d] = ymd.split('-').map(Number)
  return `${m}/${d}`
}

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const

export function contentTypeLabel(contentType: string | null | undefined) {
  if (contentType === 'shortform') return '숏폼'
  if (contentType === 'longform') return '롱폼'
  return '기타'
}
