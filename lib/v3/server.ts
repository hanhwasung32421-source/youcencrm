// V3 API 라우트 공통 서버 헬퍼. (클라이언트 컴포넌트에서 import 금지)

import { NextResponse } from 'next/server'
import { getBearerToken, getProfileByAccessToken } from '@/lib/auth/session'
import { SHARED_TABLES, V3_SQL_FILE } from '@/lib/v3/tables'
import { isAdminRole } from '@/lib/v3/menu'
import type { VideoLite } from '@/lib/v3/engagement'

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

const VIDEO_FIELDS =
  'id, title, stock_name, content_type, view_count, like_count, comment_count, published_at, created_at, youtube_url, thumbnail_url, primary_owner_user_id, channel_id, last_synced_at'

// 역할에 따라 범위를 좁힌 영상 목록. 관리자는 staffId로 특정 직원만 볼 수도 있다.
export async function loadScopedVideos(
  supabaseAdmin: SupabaseAdmin,
  opts: { isAdmin: boolean; selfUserId: string; staffId?: string | null; limit?: number; sinceIso?: string }
): Promise<VideoLite[]> {
  let query = supabaseAdmin
    .from(SHARED_TABLES.videos)
    .select(VIDEO_FIELDS)
    .order('created_at', { ascending: false })
    .limit(opts.limit || 2000)
  if (opts.sinceIso) query = query.gte('created_at', opts.sinceIso)
  if (!opts.isAdmin) query = query.eq('primary_owner_user_id', opts.selfUserId)
  else if (opts.staffId) query = query.eq('primary_owner_user_id', opts.staffId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data || []) as VideoLite[]
}

// 팀 전체 영상(중앙값 등 팀 기준값 계산용) — 역할과 무관하게 항상 전체를 본다.
export async function loadTeamVideos(supabaseAdmin: SupabaseAdmin, opts: { limit?: number; sinceIso?: string } = {}): Promise<VideoLite[]> {
  let query = supabaseAdmin.from(SHARED_TABLES.videos).select(VIDEO_FIELDS).order('created_at', { ascending: false }).limit(opts.limit || 3000)
  if (opts.sinceIso) query = query.gte('created_at', opts.sinceIso)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data || []) as VideoLite[]
}

export async function loadVideosByIds(supabaseAdmin: SupabaseAdmin, ids: string[]): Promise<VideoLite[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabaseAdmin.from(SHARED_TABLES.videos).select(VIDEO_FIELDS).in('id', ids)
  if (error) throw new Error(error.message)
  return (data || []) as VideoLite[]
}

// 현재 활성화된(api_active=true) 유튜브 계정의 API 키를 가져온다. 통계 새로고침용.
export async function loadActiveYoutubeApiKey(supabaseAdmin: SupabaseAdmin): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from(SHARED_TABLES.youtubeAccounts)
    .select('api_key, api_active')
    .eq('api_active', true)
    .limit(1)
    .maybeSingle()
  const key = String((data as any)?.api_key || '').trim()
  return key || null
}
