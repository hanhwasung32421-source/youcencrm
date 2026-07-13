import { readBody } from 'h3'
import { z } from 'zod'
import { requireAdminByAccessToken } from '../../../utils/adminGuard'

const BodySchema = z.object({
  accessToken: z.string().min(10),
  userId: z.string().uuid(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendanceStatus: z.enum(['present', 'late', 'vacation', 'early_leave'])
})

export default defineEventHandler(async (event) => {
  const body = BodySchema.parse(await readBody(event))
  const { profile, admin } = await requireAdminByAccessToken(body.accessToken)

  const nowIso = new Date().toISOString()

  const attendancePayload = {
    user_id: body.userId,
    work_date: body.workDate,
    attendance_status: body.attendanceStatus,
    check_in_at: body.attendanceStatus === 'present' || body.attendanceStatus === 'late' ? nowIso : null,
    check_out_at: body.attendanceStatus === 'early_leave' ? nowIso : null,
    updated_at: nowIso
  }

  const { data: day, error: dayError } = await admin
    .from('attendance_days')
    .upsert(attendancePayload, { onConflict: 'user_id,work_date' })
    .select('id')
    .single()

  if (dayError || !day) {
    throw createError({ statusCode: 500, statusMessage: dayError?.message || '근태 저장에 실패했습니다.' })
  }

  const { error: eventError } = await admin.from('attendance_events').insert({
    attendance_day_id: day.id,
    event_type: body.attendanceStatus,
    occurred_at: nowIso,
    source: 'admin',
    note: '관리자 근태 등록'
  })

  if (eventError) {
    throw createError({ statusCode: 500, statusMessage: eventError.message })
  }

  await admin.from('audit_logs').insert({
    actor_user_id: profile.id,
    action_type: 'set_attendance',
    target_type: 'attendance_day',
    target_id: day.id,
    diff_summary: {
      user_id: body.userId,
      work_date: body.workDate,
      attendance_status: body.attendanceStatus
    }
  })

  return { ok: true }
})

