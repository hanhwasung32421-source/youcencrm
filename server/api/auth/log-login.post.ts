import { getHeader, readBody } from 'h3'
import { z } from 'zod'
import { getSupabaseAdmin } from '../../utils/supabaseAdmin'
import { getSupabasePublic } from '../../utils/supabasePublic'

const BodySchema = z.object({
  // 클라이언트에서 받은 access_token
  accessToken: z.string().min(10)
})

export default defineEventHandler(async (event) => {
  const body = BodySchema.parse(await readBody(event))

  const supabasePublic = getSupabasePublic()
  const { data: userData, error: userError } = await supabasePublic.auth.getUser(body.accessToken)
  if (userError || !userData.user) {
    throw createError({ statusCode: 401, statusMessage: '토큰이 유효하지 않습니다.' })
  }

  const ip =
    (getHeader(event, 'x-forwarded-for') || '').split(',')[0].trim() ||
    event.node.req.socket.remoteAddress ||
    null

  const userAgent = getHeader(event, 'user-agent') || null

  const admin = getSupabaseAdmin()

  // CRM 유저 찾기
  const { data: profile } = await admin
    .from('crm_users')
    .select('id')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle()

  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'CRM 프로필을 찾을 수 없습니다.' })
  }

  const { error: insertError } = await admin.from('login_events').insert({
    user_id: profile.id,
    ip_address: ip,
    user_agent: userAgent,
    success: true,
    network_zone_type: 'unknown',
    risk_level: 'low'
  })

  if (insertError) {
    throw createError({ statusCode: 500, statusMessage: insertError.message })
  }

  return { ok: true }
})

