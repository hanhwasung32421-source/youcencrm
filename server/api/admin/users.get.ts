import { getHeader } from 'h3'
import { requireAdminByAccessToken } from '../../utils/adminGuard'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: '인증 토큰이 없습니다.' })
  }

  const { admin } = await requireAdminByAccessToken(token)

  const { data, error } = await admin
    .from('crm_users')
    .select('id, name, email, role_type, employment_status, joined_at')
    .order('joined_at', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { items: data || [] }
})

