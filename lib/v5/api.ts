// V5 API 라우트 공용 도우미(서버 전용).

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getBearerToken, getProfileByAccessToken } from '@/lib/auth/session'
import { errorResponse } from '@/lib/api/error-response'
import { V5_MISSING_TABLE_MESSAGE, V5_TABLES } from '@/lib/v5/tables'
import { isAdminRoleType } from '@/lib/v5/menu'
import type { StaffUser } from '@/lib/v5/types'

// 사용자가 아직 supabase/sql/v5/100_v5_growth_lab.sql 을 실행하지 않았을 때 PostgREST가 내는 오류.
export function isMissingTableError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string }
  if (e.code === '42P01') return true
  return /does not exist|Could not find the table|schema cache/i.test(e.message || '')
}

export function missingTableResponse() {
  return NextResponse.json({ error: V5_MISSING_TABLE_MESSAGE }, { status: 409 })
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function forbidden(message = '관리자 권한이 필요합니다.') {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function notFound(message = '항목을 찾을 수 없습니다.') {
  return NextResponse.json({ error: message }, { status: 404 })
}

// zod 검증 실패를 400으로, 나머지는 500으로.
export function handleRouteError(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    const first = error.issues[0]
    const path = first?.path?.length ? `${first.path.join('.')}: ` : ''
    return NextResponse.json({ error: `입력값을 확인해 주세요. ${path}${first?.message || ''}`.trim() }, { status: 400 })
  }
  if (error instanceof Error && /로그인이 필요|프로필을 찾을 수 없/.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }
  return errorResponse(error, fallback)
}

export type Session = Awaited<ReturnType<typeof getProfileByAccessToken>> & { isAdmin: boolean }

export async function getSession(request: Request): Promise<Session> {
  const token = getBearerToken(request)
  if (!token) throw new Error('로그인이 필요합니다.')
  const session = await getProfileByAccessToken(token)
  return { ...session, isAdmin: isAdminRoleType(session.profile.role_type) }
}

// 요청 바디를 안전하게 JSON 파싱(빈 바디 허용).
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

// 이름 매핑용 crm_users 조회. 실패해도 빈 맵을 돌려주고 화면은 계속 그린다.
export async function loadUserMap(supabaseAdmin: Session['supabaseAdmin'], ids?: Iterable<string | null | undefined>) {
  const wanted = ids ? Array.from(new Set(Array.from(ids).filter((v): v is string => Boolean(v)))) : null
  if (wanted && wanted.length === 0) return new Map<string, string>()
  let query = supabaseAdmin.from(V5_TABLES.crmUsers).select('id, name')
  if (wanted) query = query.in('id', wanted)
  const { data } = await query
  const map = new Map<string, string>()
  for (const row of (data || []) as Array<{ id: string; name: string }>) map.set(row.id, row.name)
  return map
}

export async function loadStaffUsers(supabaseAdmin: Session['supabaseAdmin']): Promise<StaffUser[]> {
  const { data } = await supabaseAdmin
    .from(V5_TABLES.crmUsers)
    .select('id, name, role_type, employment_status')
    .order('name', { ascending: true })
  return ((data || []) as Array<{ id: string; name: string; role_type: string; employment_status: string | null }>)
    .filter((u) => u.role_type !== 'retired' && u.employment_status !== 'retired')
    .map((u) => ({ id: u.id, name: u.name, role_type: u.role_type }))
}

// 실험/플레이북 폼의 "대상 영상" 드롭다운용 — 팀 전체 최근 영상(최대 300건).
export async function loadVideoOptions(supabaseAdmin: Session['supabaseAdmin'], limit = 300) {
  const { data } = await supabaseAdmin
    .from(V5_TABLES.videos)
    .select('id, title, stock_name, content_type, published_at, view_count, like_count, comment_count, youtube_url, thumbnail_url, primary_owner_user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data || []) as Array<{
    id: string
    title: string | null
    stock_name: string
    content_type: string
    published_at: string | null
    view_count: number | null
    like_count: number | null
    comment_count: number | null
    youtube_url: string
    thumbnail_url: string | null
    primary_owner_user_id: string | null
    created_at: string
  }>
}

export const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다.')
export const optionalYmd = z.preprocess((v) => (v === '' ? null : v), ymdSchema.nullable().optional())
export const optionalText = z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(2000).nullable().optional())
export const amountSchema = z.coerce.number().int().min(0).max(1_000_000_000_000)
