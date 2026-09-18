// V3 수익화 · 정산 도메인의 순수 로직. 서버(API)와 클라이언트(페이지)가 같이 쓰므로
// Supabase/Next 의존성을 두지 않는다.

// ─────────────────────────────────────────────────────────────
// 수익원(스트림) 유형
// ─────────────────────────────────────────────────────────────
export const STREAM_TYPES = ['adsense', 'membership', 'superchat', 'sponsorship', 'leading_product', 'other'] as const
export type StreamType = (typeof STREAM_TYPES)[number]

export const STREAM_LABELS: Record<StreamType, string> = {
  adsense: '애드센스',
  membership: '멤버십',
  superchat: '슈퍼챗',
  sponsorship: '협찬·광고',
  leading_product: '리딩 상품',
  other: '기타'
}

// V3 태그 팔레트(theme.css): blue, green, amber, red, violet, gray
export const STREAM_COLORS: Record<StreamType, string> = {
  adsense: '#3b6fe0',
  membership: '#2f9e6e',
  superchat: '#d9822b',
  sponsorship: '#e0574b',
  leading_product: '#9b7ede',
  other: '#a8a49d'
}

// 조회수 비례 배분 대상 스트림(협찬·광고는 계약 단위라 제외)
export const VIEW_SHARED_STREAMS: StreamType[] = ['adsense', 'membership', 'superchat', 'leading_product', 'other']

// ─────────────────────────────────────────────────────────────
// 비용 유형
// ─────────────────────────────────────────────────────────────
export const EXPENSE_TYPES = ['labor', 'equipment', 'software', 'marketing', 'other'] as const
export type ExpenseType = (typeof EXPENSE_TYPES)[number]

export const EXPENSE_LABELS: Record<ExpenseType, string> = {
  labor: '인건비',
  equipment: '장비',
  software: '소프트웨어',
  marketing: '마케팅',
  other: '기타'
}

// ─────────────────────────────────────────────────────────────
// 협찬 인보이스 상태
// ─────────────────────────────────────────────────────────────
export const INVOICE_STATUSES = ['draft', 'issued', 'paid', 'overdue'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: '초안',
  issued: '발행됨',
  paid: '입금완료',
  overdue: '연체'
}

export const INVOICE_STATUS_TONES: Record<InvoiceStatus, 'gray' | 'blue' | 'green' | 'red'> = {
  draft: 'gray',
  issued: 'blue',
  paid: 'green',
  overdue: 'red'
}

// ─────────────────────────────────────────────────────────────
// 레코드 타입
// ─────────────────────────────────────────────────────────────
export type RevenueEntry = {
  id: string
  month: string
  stream_type: StreamType
  channel_id: string | null
  channel_name?: string | null
  amount: number
  memo: string | null
  evidence_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SponsorshipInvoice = {
  id: string
  advertiser_name: string
  campaign_name: string
  contract_amount: number
  staff_user_id: string | null
  staff_name?: string | null
  video_url: string | null
  status: InvoiceStatus
  issued_at: string | null
  due_at: string | null
  paid_at: string | null
  memo: string | null
  created_at: string
  updated_at: string
}

export type IncentiveRule = {
  user_id: string
  base_pay: number
  per_video: number
  per_1k_views: number
  longform_weight: number
  shortform_weight: number
  updated_at?: string | null
}

export type IncentiveSettlement = {
  id: string
  user_id: string
  month: string
  video_count: number
  total_views: number
  computed_amount: number
  confirmed_at: string | null
  confirmed_by: string | null
}

export type ExpenseEntry = {
  id: string
  month: string
  expense_type: ExpenseType
  amount: number
  memo: string | null
  created_by: string | null
  created_at: string
}

export type VideoLite = {
  id: string
  title: string | null
  stock_name: string | null
  content_type: 'longform' | 'shortform'
  view_count: number | null
  published_at: string | null
  created_at: string
  youtube_url: string | null
  primary_owner_user_id: string
}

// 규칙 테이블이 없거나 직원별 규칙이 없을 때 쓰는 기본 규칙
export const DEFAULT_INCENTIVE_RULE: Omit<IncentiveRule, 'user_id'> = {
  base_pay: 0,
  per_video: 20000,
  per_1k_views: 500,
  longform_weight: 1,
  shortform_weight: 0.5
}

// ─────────────────────────────────────────────────────────────
// 월(YYYY-MM) 유틸 — 모두 KST(UTC+9) 기준
// ─────────────────────────────────────────────────────────────
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export function getCurrentMonth(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 7)
}

export function isValidMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const index = y * 12 + (m - 1) + delta
  const ny = Math.floor(index / 12)
  const nm = (index % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

export function lastNMonths(endMonth: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftMonth(endMonth, -(n - 1 - i)))
}

// 해당 월의 [시작, 끝) 구간을 ISO(UTC) 문자열로 돌려준다.
export function monthRangeIso(month: string): { start: string; end: string } {
  const start = new Date(`${month}-01T00:00:00+09:00`).toISOString()
  const end = new Date(`${shiftMonth(month, 1)}-01T00:00:00+09:00`).toISOString()
  return { start, end }
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-')
  return `${y}년 ${Number(m)}월`
}

export function formatMonthShort(month: string): string {
  return `${Number(month.split('-')[1])}월`
}

// ─────────────────────────────────────────────────────────────
// 인센티브 계산
//   정산액 = 기본급
//          + Σ영상 ( 영상당 단가 × 가중치(콘텐츠 유형) )
//          + Σ영상 ( 조회수 / 1,000 × 조회수 1,000당 단가 × 가중치 )
//   가중치: longform → longform_weight, shortform → shortform_weight
//   결과는 원 단위로 내림
// ─────────────────────────────────────────────────────────────
export type IncentiveBreakdown = {
  videoCount: number
  longformCount: number
  shortformCount: number
  totalViews: number
  weightedVideoUnits: number
  weightedViews: number
  basePay: number
  videoPay: number
  viewPay: number
  amount: number
}

export function computeIncentive(rule: Omit<IncentiveRule, 'user_id'>, videos: VideoLite[]): IncentiveBreakdown {
  let longformCount = 0
  let shortformCount = 0
  let totalViews = 0
  let weightedVideoUnits = 0
  let weightedViews = 0

  for (const video of videos) {
    const weight = video.content_type === 'shortform' ? Number(rule.shortform_weight) : Number(rule.longform_weight)
    const views = Number(video.view_count || 0)
    if (video.content_type === 'shortform') shortformCount += 1
    else longformCount += 1
    totalViews += views
    weightedVideoUnits += weight
    weightedViews += views * weight
  }

  const basePay = Number(rule.base_pay || 0)
  const videoPay = Math.floor(weightedVideoUnits * Number(rule.per_video || 0))
  const viewPay = Math.floor((weightedViews / 1000) * Number(rule.per_1k_views || 0))

  return {
    videoCount: videos.length,
    longformCount,
    shortformCount,
    totalViews,
    weightedVideoUnits,
    weightedViews,
    basePay,
    videoPay,
    viewPay,
    amount: basePay + videoPay + viewPay
  }
}

// ─────────────────────────────────────────────────────────────
// 손익
// ─────────────────────────────────────────────────────────────
export type PnlStatement = {
  month: string
  revenueByStream: Record<StreamType, number>
  revenueTotal: number
  expenseByType: Record<ExpenseType, number>
  expenseTotal: number
  incentiveTotal: number
  netProfit: number
  marginPct: number | null
}

export function emptyStreamMap(): Record<StreamType, number> {
  return { adsense: 0, membership: 0, superchat: 0, sponsorship: 0, leading_product: 0, other: 0 }
}

export function emptyExpenseMap(): Record<ExpenseType, number> {
  return { labor: 0, equipment: 0, software: 0, marketing: 0, other: 0 }
}

export function sumStreams(entries: Pick<RevenueEntry, 'stream_type' | 'amount'>[]): Record<StreamType, number> {
  const map = emptyStreamMap()
  for (const entry of entries) {
    if (entry.stream_type in map) map[entry.stream_type] += Number(entry.amount || 0)
  }
  return map
}

export function sumExpenses(entries: Pick<ExpenseEntry, 'expense_type' | 'amount'>[]): Record<ExpenseType, number> {
  const map = emptyExpenseMap()
  for (const entry of entries) {
    if (entry.expense_type in map) map[entry.expense_type] += Number(entry.amount || 0)
  }
  return map
}

export function buildPnl(
  month: string,
  revenueByStream: Record<StreamType, number>,
  expenseByType: Record<ExpenseType, number>,
  incentiveTotal: number
): PnlStatement {
  const revenueTotal = Object.values(revenueByStream).reduce((a, b) => a + b, 0)
  const expenseTotal = Object.values(expenseByType).reduce((a, b) => a + b, 0)
  const netProfit = revenueTotal - expenseTotal - incentiveTotal
  return {
    month,
    revenueByStream,
    revenueTotal,
    expenseByType,
    expenseTotal,
    incentiveTotal,
    netProfit,
    marginPct: revenueTotal > 0 ? (netProfit / revenueTotal) * 100 : null
  }
}

export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / Math.abs(previous)) * 100
}
