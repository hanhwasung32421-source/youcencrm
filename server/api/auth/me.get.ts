import { getHeader } from 'h3'
import { getSupabaseAdmin } from '../../utils/supabaseAdmin'
import { getSupabasePublic } from '../../utils/supabasePublic'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: '인증 토큰이 없습니다.' })
  }

  const supabasePublic = getSupabasePublic()
  const { data: userData, error: userError } = await supabasePublic.auth.getUser(token)
  if (userError || !userData.user) {
    throw createError({ statusCode: 401, statusMessage: '토큰이 유효하지 않습니다.' })
  }

  const admin = getSupabaseAdmin()
  const { data: profile, error: profileError } = await admin
    .from('crm_users')
    .select('id, role_type, name, employment_status')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle()

  if (profileError || !profile) {
    throw createError({ statusCode: 404, statusMessage: 'CRM 프로필을 찾을 수 없습니다.' })
  }

  return {
    crmUserId: profile.id,
    roleType: profile.role_type,
    name: profile.name,
    employmentStatus: profile.employment_status
  }
})

