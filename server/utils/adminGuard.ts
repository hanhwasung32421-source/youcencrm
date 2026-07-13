import { getSupabaseAdmin } from './supabaseAdmin'
import { getSupabasePublic } from './supabasePublic'

export async function requireAdminByAccessToken(accessToken: string) {
  const supabasePublic = getSupabasePublic()
  const { data: userData, error: userError } = await supabasePublic.auth.getUser(accessToken)
  if (userError || !userData.user) {
    throw createError({ statusCode: 401, statusMessage: '로그인이 필요합니다.' })
  }

  const admin = getSupabaseAdmin()
  const { data: profile, error: profileError } = await admin
    .from('crm_users')
    .select('id, role_type, name')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle()

  if (profileError || !profile) {
    throw createError({ statusCode: 404, statusMessage: 'CRM 프로필을 찾을 수 없습니다.' })
  }

  if (!['super_admin', 'admin'].includes(profile.role_type)) {
    throw createError({ statusCode: 403, statusMessage: '총 관리자 또는 관리자 권한이 필요합니다.' })
  }

  return { profile, admin }
}

