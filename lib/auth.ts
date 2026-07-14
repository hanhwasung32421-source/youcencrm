import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { createSupabasePublicClient } from '@/lib/supabase-public'

export async function getProfileByAccessToken(accessToken: string) {
  const supabasePublic = createSupabasePublicClient()
  const { data: userData, error: userError } = await supabasePublic.auth.getUser(accessToken)

  if (userError || !userData.user) {
    throw new Error('로그인이 필요합니다.')
  }

  const supabaseAdmin = createSupabaseAdminClient()
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('crm_users')
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
