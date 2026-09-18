// V4 API 라우트 공통: 인증, 에러 응답, 영상/사용자 조회.
// 서버 전용 (Next route handler에서만 import).

import { NextResponse } from 'next/server'
import { getBearerToken, getProfileByAccessToken } from '@/lib/auth/session'
import { errorResponse } from '@/lib/api/error-response'
import { isAdminRole } from '@/lib/v4/menu'
import { V4_TABLES } from '@/lib/v4/tables'
import { VIDEO_COLUMNS, isActiveStaff, type UserLite, type VideoRow } from '@/lib/v4/analytics'

export class V4HttpError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

type SupabaseAdmin = Awaited<ReturnType<typeof getProfileByAccessToken>>['supabaseAdmin']

export type V4Context = {
  profile: { id: string; name: string; email: string; role_type: string }
  supabaseAdmin: SupabaseAdmin
  isAdmin: boolean
}

export async function requireV4User(request: Request): Promise<V4Context> {
  const token = getBearerToken(request)
  if (!token) throw new V4HttpError('로그인이 필요합니다.', 401)
  let result: Awaited<ReturnType<typeof getProfileByAccessToken>>
  try {
    result = await getProfileByAccessToken(token)
  } catch (e: any) {
    throw new V4HttpError(e?.message || '로그인이 필요합니다.', 401)
  }
  const { profile, supabaseAdmin } = result
  return {
    profile: { id: profile.id, name: profile.name, email: profile.email, role_type: profile.role_type },
    supabaseAdmin,
    isAdmin: isAdminRole(profile.role_type)
  }
}

export async function requireV4Admin(request: Request): Promise<V4Context> {
  const ctx = await requireV4User(request)
  if (!ctx.isAdmin) throw new V4HttpError('관리자 권한이 필요합니다.', 403)
  return ctx
}

export function v4ErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof V4HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return errorResponse(error, fallbackMessage)
}

// 기간(created_at) + 직원 범위로 영상을 가져온다. 필요한 컬럼만 select.
export async function loadVideos(
  supabaseAdmin: SupabaseAdmin,
  options: { startIso?: string; endIso?: string; ownerId?: string | null; limit?: number }
): Promise<VideoRow[]> {
  let query = supabaseAdmin.from(V4_TABLES.videos).select(VIDEO_COLUMNS).order('created_at', { ascending: false })
  if (options.startIso) query = query.gte('created_at', options.startIso)
  if (options.endIso) query = query.lte('created_at', options.endIso)
  if (options.ownerId) query = query.eq('primary_owner_user_id', options.ownerId)
  if (options.limit) query = query.limit(options.limit)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data || []) as VideoRow[]
}

export async function loadUsers(supabaseAdmin: SupabaseAdmin) {
  const { data, error } = await supabaseAdmin
    .from(V4_TABLES.crmUsers)
    .select('id, name, role_type, employment_status')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  const users = (data || []) as UserLite[]
  const map = new Map(users.map((u) => [u.id, u]))
  const staff = users.filter(isActiveStaff)
  return { users, map, staff }
}

export async function readJson<T = any>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    return {} as T
  }
}
