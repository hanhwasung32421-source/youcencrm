// V3 API 라우트 공통 서버 헬퍼. (클라이언트 컴포넌트에서 import 금지)

import { NextResponse } from 'next/server'
import { getBearerToken, getProfileByAccessToken } from '@/lib/auth/session'
import { SHARED_TABLES, V3_SQL_FILE, V3_TABLES } from '@/lib/v3/tables'
import {
  computeIncentive,
  DEFAULT_INCENTIVE_RULE,
  monthRangeIso,
  type IncentiveBreakdown,
  type IncentiveRule,
  type IncentiveSettlement,
  type VideoLite
} from '@/lib/v3/finance'
import { isAdminRole } from '@/lib/v3/menu'
import { sampleIncentiveRules, sampleSettlements } from '@/lib/v3/sample-data'

export type SupabaseAdmin = Awaited<ReturnType<typeof getProfileByAccessToken>>['supabaseAdmin']
export type Profile = Awaited<ReturnType<typeof getProfileByAccessToken>>['profile']

export const MISSING_TABLE_MESSAGE = `V3 테이블이 아직 생성되지 않았습니다. ${V3_SQL_FILE} 을 실행해 주세요.`

// PostgREST가 돌려주는 "테이블 없음" 에러 판별
export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { code?: string; message?: string }
  if (err.code === '42P01') return true
  return /does not exist|Could not find the table|schema cache/i.test(err.message || '')
}

export function missingTableResponse() {
  return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 409 })
}

type AuthOk = { ok: true; profile: Profile; supabaseAdmin: SupabaseAdmin; isAdmin: boolean }
type AuthFail = { ok: false; response: NextResponse }

export async function authenticate(request: Request): Promise<AuthOk | AuthFail> {
  const token = getBearerToken(request)
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: '인증 토큰이 없습니다.' }, { status: 401 }) }
  }
  try {
    const { profile, supabaseAdmin } = await getProfileByAccessToken(token)
    return { ok: true, profile, supabaseAdmin, isAdmin: isAdminRole(profile.role_type) }
  } catch (e: any) {
    return { ok: false, response: NextResponse.json({ error: e?.message || '로그인이 필요합니다.' }, { status: 401 }) }
  }
}

export async function authenticateAdmin(request: Request): Promise<AuthOk | AuthFail> {
  const auth = await authenticate(request)
  if (!auth.ok) return auth
  if (!auth.isAdmin) {
    return { ok: false, response: NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 }) }
  }
  return auth
}

export async function readJson<T = any>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// 공용 로더
// ─────────────────────────────────────────────────────────────
export type StaffUser = { id: string; name: string; role_type: string; employment_status: string }

// 인센티브 대상 직원 = 관리자 역할이 아닌 재직(active) 사용자
export async function loadStaffUsers(supabaseAdmin: SupabaseAdmin): Promise<StaffUser[]> {
  const { data, error } = await supabaseAdmin
    .from(SHARED_TABLES.crmUsers)
    .select('id, name, role_type, employment_status')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data || []) as StaffUser[]).filter(
    (user) => !isAdminRole(user.role_type) && user.role_type !== 'retired' && user.employment_status === 'active'
  )
}

export async function loadUserNames(supabaseAdmin: SupabaseAdmin): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin.from(SHARED_TABLES.crmUsers).select('id, name')
  return new Map(((data || []) as { id: string; name: string }[]).map((row) => [row.id, row.name]))
}

// 해당 월(KST)에 CRM에 등록(created_at)된 영상. 기존 대시보드와 같은 기준을 쓴다.
export async function loadVideosForMonth(supabaseAdmin: SupabaseAdmin, month: string, userId?: string): Promise<VideoLite[]> {
  const { start, end } = monthRangeIso(month)
  let query = supabaseAdmin
    .from(SHARED_TABLES.videos)
    .select('id, title, stock_name, content_type, view_count, published_at, created_at, youtube_url, primary_owner_user_id')
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (userId) query = query.eq('primary_owner_user_id', userId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data || []) as VideoLite[]
}

// 규칙 테이블이 없으면 sample=true와 함께 기본 규칙을 돌려준다.
export async function loadIncentiveRules(
  supabaseAdmin: SupabaseAdmin,
  userIds: string[]
): Promise<{ rules: Map<string, IncentiveRule>; sample: boolean }> {
  const { data, error } = await supabaseAdmin.from(V3_TABLES.incentiveRules).select('*')
  if (error) {
    if (isMissingTableError(error)) {
      return { rules: new Map(sampleIncentiveRules(userIds).map((rule) => [rule.user_id, rule])), sample: true }
    }
    throw new Error(error.message)
  }
  const rules = new Map<string, IncentiveRule>()
  for (const row of (data || []) as IncentiveRule[]) {
    rules.set(row.user_id, {
      user_id: row.user_id,
      base_pay: Number(row.base_pay),
      per_video: Number(row.per_video),
      per_1k_views: Number(row.per_1k_views),
      longform_weight: Number(row.longform_weight),
      shortform_weight: Number(row.shortform_weight),
      updated_at: row.updated_at
    })
  }
  return { rules, sample: false }
}

export async function loadSettlements(
  supabaseAdmin: SupabaseAdmin,
  filter: { month?: string; userId?: string },
  sampleUsers: { id: string; name: string }[]
): Promise<{ settlements: IncentiveSettlement[]; sample: boolean }> {
  let query = supabaseAdmin.from(V3_TABLES.incentiveSettlements).select('*').order('month', { ascending: false })
  if (filter.month) query = query.eq('month', filter.month)
  if (filter.userId) query = query.eq('user_id', filter.userId)
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) {
      let rows = sampleSettlements(sampleUsers)
      if (filter.month) rows = rows.filter((row) => row.month === filter.month)
      if (filter.userId) rows = rows.filter((row) => row.user_id === filter.userId)
      return { settlements: rows, sample: true }
    }
    throw new Error(error.message)
  }
  return {
    settlements: ((data || []) as IncentiveSettlement[]).map((row) => ({
      ...row,
      video_count: Number(row.video_count),
      total_views: Number(row.total_views),
      computed_amount: Number(row.computed_amount)
    })),
    sample: false
  }
}

export type SettlementRow = {
  userId: string
  name: string
  rule: Omit<IncentiveRule, 'user_id'>
  ruleIsDefault: boolean
  breakdown: IncentiveBreakdown
  confirmed: IncentiveSettlement | null
}

// 선택한 월의 직원별 정산 계산: 실제 youtubeCRM_videos + 규칙(없으면 기본값) + 확정 스냅샷
export async function computeMonthlySettlements(
  supabaseAdmin: SupabaseAdmin,
  month: string
): Promise<{ rows: SettlementRow[]; rulesSample: boolean; settlementsSample: boolean }> {
  const staff = await loadStaffUsers(supabaseAdmin)
  const staffIds = staff.map((user) => user.id)
  const [videos, { rules, sample: rulesSample }, { settlements, sample: settlementsSample }] = await Promise.all([
    loadVideosForMonth(supabaseAdmin, month),
    loadIncentiveRules(supabaseAdmin, staffIds),
    loadSettlements(supabaseAdmin, { month }, staff)
  ])

  const videosByUser = new Map<string, VideoLite[]>()
  for (const video of videos) {
    const list = videosByUser.get(video.primary_owner_user_id) || []
    list.push(video)
    videosByUser.set(video.primary_owner_user_id, list)
  }
  const confirmedByUser = new Map(settlements.map((row) => [row.user_id, row]))

  const rows: SettlementRow[] = staff.map((user) => {
    const stored = rules.get(user.id)
    const rule = stored
      ? { base_pay: stored.base_pay, per_video: stored.per_video, per_1k_views: stored.per_1k_views, longform_weight: stored.longform_weight, shortform_weight: stored.shortform_weight }
      : { ...DEFAULT_INCENTIVE_RULE }
    return {
      userId: user.id,
      name: user.name,
      rule,
      ruleIsDefault: !stored,
      breakdown: computeIncentive(rule, videosByUser.get(user.id) || []),
      confirmed: confirmedByUser.get(user.id) || null
    }
  })

  return { rows, rulesSample, settlementsSample }
}

// 대시보드/손익에서 쓰는 "이 달 인센티브 합계": 확정분이 있으면 확정액, 없으면 계산액
export function sumIncentives(rows: SettlementRow[]): number {
  return rows.reduce((sum, row) => sum + (row.confirmed ? row.confirmed.computed_amount : row.breakdown.amount), 0)
}
