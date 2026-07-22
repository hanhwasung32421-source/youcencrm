import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { getAttendanceWorkedSeconds } from '@/lib/attendance'

const bodySchema = z.object({
  accessToken: z.string().min(10),
  userId: z.string().uuid(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendanceStatus: z.enum(['present', 'late', 'vacation', 'early_leave', 'checkout'])
})

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const { profile, supabaseAdmin } = await requireAdmin(body.accessToken)
    const nowIso = new Date().toISOString()

    const { data: existingDay } = await supabaseAdmin
      .from('attendance_days')
      .select('id, attendance_status, check_in_at, check_out_at')
      .eq('user_id', body.userId)
      .eq('work_date', body.workDate)
      .maybeSingle()

    let dayId = existingDay?.id

    if (body.attendanceStatus === 'checkout') {
      if (!existingDay?.id || !existingDay.check_in_at) {
        return NextResponse.json({ error: '출근 또는 지각 등록 후 퇴근할 수 있습니다.' }, { status: 400 })
      }
      const workedSeconds = getAttendanceWorkedSeconds(existingDay.check_in_at, nowIso)
      const { error: updateError } = await supabaseAdmin
        .from('attendance_days')
        .update({
          check_out_at: nowIso,
          worked_minutes: Math.floor(workedSeconds / 60),
          updated_at: nowIso
        })
        .eq('id', existingDay.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
      dayId = existingDay.id
    } else {
      const { data: day, error: upsertError } = await supabaseAdmin
        .from('attendance_days')
        .upsert(
          {
            user_id: body.userId,
            work_date: body.workDate,
            attendance_status: body.attendanceStatus,
            check_in_at: ['present', 'late'].includes(body.attendanceStatus) ? existingDay?.check_in_at || nowIso : null,
            check_out_at: body.attendanceStatus === 'early_leave' ? nowIso : existingDay?.check_out_at || null,
            updated_at: nowIso
          },
          { onConflict: 'user_id,work_date' }
        )
        .select('id')
        .single()

      if (upsertError || !day) {
        return NextResponse.json({ error: upsertError?.message || '근태 저장 실패' }, { status: 500 })
      }
      dayId = day.id
    }

    const { error: eventError } = await supabaseAdmin.from('attendance_events').insert({
      attendance_day_id: dayId,
      event_type: body.attendanceStatus === 'checkout' ? 'correction' : body.attendanceStatus,
      occurred_at: nowIso,
      source: 'admin',
      note: body.attendanceStatus === 'checkout' ? '관리자 퇴근 등록' : '관리자 근태 등록'
    })

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 })
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_user_id: profile.id,
      action_type: 'set_attendance',
      target_type: 'attendance_day',
      target_id: dayId,
      diff_summary: {
        user_id: body.userId,
        work_date: body.workDate,
        attendance_status: body.attendanceStatus
      }
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '근태 등록 실패' }, { status: 500 })
  }
}
