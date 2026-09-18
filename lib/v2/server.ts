// V2 API 라우트 공용 서버 헬퍼. 클라이언트 컴포넌트에서 import 금지.
import { NextResponse } from 'next/server'
import { getBearerToken, getProfileByAccessToken } from '@/lib/auth/session'
import { errorResponse } from '@/lib/api/error-response'
import { TABLES } from '@/lib/supabase/tables'
import { DEFAULT_DAILY_TARGET, V2_MISSING_TABLE_MESSAGE, V2_TABLES } from './tables'
import { addDays, kstDayEnd, kstDayStart, kstYmd } from './dates'
import type { ChecklistTemplate, ContentType, ProductionItem, RecentStock, StaffLite } from './types'

// 테이블이 아직 없을 때(사용자가 SQL을 실행하기 전) PostgREST/Postgres가 내는 오류 패턴
export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string }
  if (e.code === '42P01') return true
  return /does not exist|Could not find the table|schema cache/i.test(String(e.message || ''))
}

export function missingTableResponse() {
  return NextResponse.json({ error: V2_MISSING_TABLE_MESSAGE }, { status: 409 })
}

export function isAdminRole(roleType: string) {
  return roleType === 'super_admin' || roleType === 'admin'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseAdmin = any

export type AuthedContext = {
  profile: { id: string; name: string; email: string; role_type: string; employment_status: string }
  supabaseAdmin: SupabaseAdmin
  isAdmin: boolean
}

export async function authedContext(request: Request): Promise<AuthedContext> {
  const { profile, supabaseAdmin } = await getProfileByAccessToken(getBearerToken(request))
  return { profile, supabaseAdmin, isAdmin: isAdminRole(profile.role_type) }
}

export function forbidden(message = '관리자 권한이 필요합니다.') {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function unauthorizedResponse(e: unknown) {
  const message = e instanceof Error ? e.message : '로그인이 필요합니다.'
  return NextResponse.json({ error: message }, { status: 401 })
}

// zod 검증 실패는 400, 나머지는 공통 errorResponse
export function handleRouteError(e: unknown, fallback: string) {
  const issues = (e as { issues?: { message?: string }[] })?.issues
  if (issues?.[0]?.message) {
    return NextResponse.json({ error: issues[0].message }, { status: 400 })
  }
  if (e instanceof Error && /로그인이 필요|프로필을 찾을 수 없/.test(e.message)) {
    return unauthorizedResponse(e)
  }
  return errorResponse(e, fallback)
}

export function handleDbError(error: unknown, fallback: string) {
  if (isMissingTableError(error)) return missingTableResponse()
  return errorResponse(error, fallback)
}

// 활성 직원 목록(퇴사 제외). 담당자 선택/워크로드 기준.
export async function loadStaff(supabaseAdmin: SupabaseAdmin): Promise<StaffLite[]> {
  const { data } = await supabaseAdmin
    .from(TABLES.crmUsers)
    .select('id, name, role_type, employment_status')
    .neq('role_type', 'retired')
    .eq('employment_status', 'active')
    .order('name', { ascending: true })

  const rows = (data || []) as { id: string; name: string; role_type: string }[]
  // 직원(유튜버)을 앞에, 관리자를 뒤에
  rows.sort((a, b) => Number(isAdminRole(a.role_type)) - Number(isAdminRole(b.role_type)) || a.name.localeCompare(b.name, 'ko'))
  return rows.map((row) => ({ id: row.id, name: row.name, roleType: row.role_type }))
}

export async function loadStaffMap(supabaseAdmin: SupabaseAdmin): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin.from(TABLES.crmUsers).select('id, name')
  const map = new Map<string, string>()
  for (const row of (data || []) as { id: string; name: string }[]) map.set(row.id, row.name)
  return map
}

// 담당자별 일일 목표. 테이블이 없으면 전부 기본값.
export async function loadTargets(supabaseAdmin: SupabaseAdmin, userIds: string[]): Promise<Record<string, number>> {
  const targets: Record<string, number> = {}
  for (const id of userIds) targets[id] = DEFAULT_DAILY_TARGET
  if (userIds.length === 0) return targets
  const { data, error } = await supabaseAdmin.from(V2_TABLES.staffTargets).select('user_id, daily_target').in('user_id', userIds)
  if (error) return targets
  for (const row of (data || []) as { user_id: string; daily_target: number }[]) {
    targets[row.user_id] = Number(row.daily_target)
  }
  return targets
}

// 기간 내 등록된 영상을 담당자별로 센다 (youtubeCRM_videos.created_at 기준)
export async function countVideosByUser(
  supabaseAdmin: SupabaseAdmin,
  startIso: string,
  endIso: string,
  userIds?: string[]
): Promise<Record<string, number>> {
  let query = supabaseAdmin
    .from(TABLES.videos)
    .select('primary_owner_user_id')
    .gte('created_at', startIso)
    .lt('created_at', endIso)
  if (userIds && userIds.length > 0) query = query.in('primary_owner_user_id', userIds)
  const { data } = await query
  const counts: Record<string, number> = {}
  for (const row of (data || []) as { primary_owner_user_id: string }[]) {
    counts[row.primary_owner_user_id] = (counts[row.primary_owner_user_id] || 0) + 1
  }
  return counts
}

// 최근 N일 담당자별 일자별 등록 수 (스파크라인용)
export async function videoCountsByUserAndDay(
  supabaseAdmin: SupabaseAdmin,
  days: string[],
  userIds: string[]
): Promise<Record<string, Record<string, number>>> {
  const result: Record<string, Record<string, number>> = {}
  for (const id of userIds) {
    result[id] = {}
    for (const day of days) result[id][day] = 0
  }
  if (days.length === 0 || userIds.length === 0) return result
  const start = kstDayStart(days[0]).toISOString()
  const end = kstDayEnd(days[days.length - 1]).toISOString()
  const { data } = await supabaseAdmin
    .from(TABLES.videos)
    .select('primary_owner_user_id, created_at')
    .gte('created_at', start)
    .lt('created_at', end)
    .in('primary_owner_user_id', userIds)
  for (const row of (data || []) as { primary_owner_user_id: string; created_at: string }[]) {
    const day = kstYmd(new Date(row.created_at))
    if (result[row.primary_owner_user_id] && day in result[row.primary_owner_user_id]) {
      result[row.primary_owner_user_id][day] += 1
    }
  }
  return result
}

// production_items 원본 행 → API 응답 형태 (담당자 이름, 체크리스트 진행률 부착)
type RawItem = Omit<ProductionItem, 'assignee_name' | 'checklist_done' | 'checklist_total'>

export async function decorateItems(supabaseAdmin: SupabaseAdmin, rows: RawItem[]): Promise<ProductionItem[]> {
  if (rows.length === 0) return []
  const staffMap = await loadStaffMap(supabaseAdmin)
  const progress = await loadChecklistProgress(
    supabaseAdmin,
    rows.map((row) => row.id)
  )
  return rows.map((row) => ({
    ...row,
    assignee_name: row.assignee_user_id ? staffMap.get(row.assignee_user_id) || null : null,
    checklist_done: progress[row.id]?.done ?? 0,
    checklist_total: progress[row.id]?.total ?? 0
  }))
}

export async function loadChecklistProgress(
  supabaseAdmin: SupabaseAdmin,
  itemIds: string[]
): Promise<Record<string, { done: number; total: number }>> {
  const result: Record<string, { done: number; total: number }> = {}
  if (itemIds.length === 0) return result
  const { data, error } = await supabaseAdmin
    .from(V2_TABLES.productionChecklists)
    .select('production_item_id, checked')
    .in('production_item_id', itemIds)
  if (error) return result
  for (const row of (data || []) as { production_item_id: string; checked: boolean }[]) {
    const bucket = result[row.production_item_id] || (result[row.production_item_id] = { done: 0, total: 0 })
    bucket.total += 1
    if (row.checked) bucket.done += 1
  }
  return result
}

// 아이템 콘텐츠 형식에 맞는 기본 템플릿을 골라 체크리스트 행을 만든다(이미 있으면 건너뜀).
export async function materializeChecklist(
  supabaseAdmin: SupabaseAdmin,
  item: { id: string; content_type: ContentType }
): Promise<{ rows: { item_index: number; label: string; checked: boolean }[]; templateName: string | null }> {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from(V2_TABLES.productionChecklists)
    .select('item_index, label, checked')
    .eq('production_item_id', item.id)
    .order('item_index', { ascending: true })
  if (existingError) throw existingError
  if (existing && existing.length > 0) {
    return { rows: existing, templateName: null }
  }

  const { data: templates, error: templateError } = await supabaseAdmin
    .from(V2_TABLES.checklistTemplates)
    .select('id, name, content_type, items, is_default, created_at')
    .order('created_at', { ascending: true })
  if (templateError) throw templateError

  const list = (templates || []) as ChecklistTemplate[]
  const template =
    list.find((t) => t.content_type === item.content_type && t.is_default) ||
    list.find((t) => t.content_type === null && t.is_default) ||
    list.find((t) => t.content_type === item.content_type) ||
    list[0]
  if (!template) return { rows: [], templateName: null }

  const labels = Array.isArray(template.items) ? template.items.map((label) => String(label)).filter(Boolean) : []
  if (labels.length === 0) return { rows: [], templateName: template.name }

  const payload = labels.map((label, index) => ({
    production_item_id: item.id,
    item_index: index,
    label,
    checked: false
  }))
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from(V2_TABLES.productionChecklists)
    .upsert(payload, { onConflict: 'production_item_id,item_index' })
    .select('item_index, label, checked')
    .order('item_index', { ascending: true })
  if (insertError) throw insertError
  return { rows: inserted || [], templateName: template.name }
}

// 최근 7일 등록 영상의 종목명 집계 — 중복 소재를 피하기 위한 힌트
export async function loadRecentStocks(supabaseAdmin: SupabaseAdmin, days = 7): Promise<RecentStock[]> {
  const start = kstDayStart(addDays(kstYmd(), -(days - 1))).toISOString()
  const { data, error } = await supabaseAdmin
    .from(TABLES.videos)
    .select('stock_name, created_at')
    .gte('created_at', start)
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) return []
  const map = new Map<string, RecentStock>()
  for (const row of (data || []) as { stock_name: string; created_at: string }[]) {
    const name = String(row.stock_name || '').trim()
    if (!name) continue
    const bucket = map.get(name)
    if (bucket) {
      bucket.count += 1
      if (row.created_at > bucket.last_at) bucket.last_at = row.created_at
    } else {
      map.set(name, { stock_name: name, count: 1, last_at: row.created_at })
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || (a.last_at < b.last_at ? 1 : -1))
}

export function nowIso() {
  return new Date().toISOString()
}
