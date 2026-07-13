import { getQuery, getHeader } from 'h3'
import { requireAdminByAccessToken } from '../../utils/adminGuard'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: '인증 토큰이 없습니다.' })
  }

  const { admin } = await requireAdminByAccessToken(token)
  const query = getQuery(event)
  const period = String(query.period || 'day')

  const now = new Date()
  let startDate = new Date(now)
  if (period === 'week') startDate.setDate(now.getDate() - 6)
  if (period === 'month') startDate.setDate(now.getDate() - 29)
  const start = startDate.toISOString().slice(0, 10)

  const { data: users, error: userError } = await admin
    .from('crm_users')
    .select('id, name, role_type, employment_status')
    .order('name', { ascending: true })

  if (userError) {
    throw createError({ statusCode: 500, statusMessage: userError.message })
  }

  const { data: days, error: daysError } = await admin
    .from('attendance_days')
    .select('id, user_id, work_date, attendance_status, check_in_at, check_out_at')
    .gte('work_date', start)
    .order('work_date', { ascending: false })

  if (daysError) {
    throw createError({ statusCode: 500, statusMessage: daysError.message })
  }

  return {
    period,
    startDate: start,
    users: users || [],
    days: days || []
  }
})

