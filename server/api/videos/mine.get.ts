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

  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'CRM 프로필을 찾을 수 없습니다.' })
  }

  let query = admin
    .from('videos')
    .select('id, title, stock_name, content_type, published_at, view_count, like_count, comment_count, youtube_url, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  if (profile.role_type === 'creator') {
    query = query.eq('primary_owner_user_id', profile.id)
  }

  const { data, error } = await query
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { items: data || [] }
})

