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
  const { data: profile } = await admin
    .from('crm_users')
    .select('id, role_type')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle()

  if (!profile || !['super_admin', 'admin'].includes(profile.role_type)) {
    throw createError({ statusCode: 403, statusMessage: '관리자 권한이 필요합니다.' })
  }

  const today = new Date().toISOString().slice(0, 10)
  const dayStart = `${today}T00:00:00.000Z`

  const { count: todayVideoCount } = await admin
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', dayStart)

  const { count: unknownIpCount } = await admin
    .from('login_events')
    .select('*', { count: 'exact', head: true })
    .eq('network_zone_type', 'unknown')
    .gte('logged_in_at', dayStart)

  const { data: latest } = await admin
    .from('videos')
    .select('id, title, stock_name, content_type, published_at, view_count')
    .order('created_at', { ascending: false })
    .limit(10)

  return {
    todayRegisteredCount: todayVideoCount || 0,
    unknownIpCount: unknownIpCount || 0,
    latest: latest || []
  }
})
