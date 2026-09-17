import { createSupabaseAdminClient } from '@/lib/supabase/admin-client'
import { createSupabasePublicClient } from '@/lib/supabase/public-client'
import { TABLES } from '@/lib/supabase/tables'

// 세션 토큰은 항상 Authorization 헤더로만 받는다. 요청 바디에 실으면 로그·APM
// 도구가 페이로드를 남길 때 토큰까지 함께 저장될 수 있어 헤더보다 유출 위험이 크다.
export function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization') || ''
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
}

// supabase.auth.admin.listUsers()는 기본 perPage=50이라, 직원이 50명을 넘으면
// 이메일 중복확인이 뒤쪽 페이지를 누락해 "사용 가능"으로 잘못 응답할 수 있었다.
// 전체 페이지를 다 돌면서 찾는다(최대 20페이지=20,000명까지 안전).
export async function findAuthUserByEmail(supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>, email: string) {
  const target = email.toLowerCase()
  const perPage = 1000
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message)
    const found = data.users.find((user) => user.email?.toLowerCase() === target)
    if (found) return found
    if (data.users.length < perPage) return null
  }
  return null
}

export async function getProfileByAccessToken(accessToken: string) {
  const supabasePublic = createSupabasePublicClient()
  const { data: userData, error: userError } = await supabasePublic.auth.getUser(accessToken)

  if (userError || !userData.user) {
    throw new Error('로그인이 필요합니다.')
  }

  const supabaseAdmin = createSupabaseAdminClient()
  const { data: profile, error: profileError } = await supabaseAdmin
    .from(TABLES.crmUsers)
    .select('id, name, email, role_type, custom_role_code, employment_status')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle()

  if (profileError || !profile) {
    throw new Error('CRM 프로필을 찾을 수 없습니다.')
  }

  return { profile, supabaseAdmin, user: userData.user }
}

export async function requireAdmin(accessToken: string) {
  const { profile, supabaseAdmin, user } = await getProfileByAccessToken(accessToken)
  if (!['super_admin', 'admin'].includes(profile.role_type)) {
    throw new Error('총 관리자 또는 관리자 권한이 필요합니다.')
  }

  return { profile, supabaseAdmin, user }
}
