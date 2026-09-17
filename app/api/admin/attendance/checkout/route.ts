import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getBearerToken, requireAdmin } from '@/lib/auth/session'
import { getAttendanceWorkedSeconds } from '@/lib/attendance/time'
import { TABLES } from '@/lib/supabase/tables'
import { errorResponse } from '@/lib/api/error-response'

const bodySchema = z.object({
  userId: z.string().uuid(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
})

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const { supabaseAdmin } = await requireAdmin(getBearerToken(request))
    const nowIso = new Date().toISOString()

    const { data: existingDay } = await supabaseAdmin
      .from(TABLES.attendanceDays)
      .select('id, attendance_status, check_in_at, check_out_at')
      .eq('user_id', body.userId)
      .eq('work_date', body.workDate)
      .maybeSingle()

    let dayId = existingDay?.id

    if (!dayId || !existingDay?.check_in_at) {
      return NextResponse.json({ error: '출근 또는 지각 등록 후 퇴근할 수 있습니다.' }, { status: 400 })
    }

    const workedSeconds = getAttendanceWorkedSeconds(existingDay.check_in_at, nowIso)
    const { error: updateError } = await supabaseAdmin
      .from(TABLES.attendanceDays)
      .update({
        check_out_at: nowIso,
        worked_minutes: Math.floor(workedSeconds / 60),
        updated_at: nowIso
      })
      .eq('id', dayId)

    if (updateError) {
      return errorResponse(updateError, '퇴근 등록 실패')
    }

    const { error: eventError } = await supabaseAdmin.from(TABLES.attendanceEvents).insert({
      attendance_day_id: dayId,
      event_type: 'correction',
      occurred_at: nowIso,
      source: 'admin',
      note: '관리자 퇴근 등록'
    })

    if (eventError) {
      return errorResponse(eventError, '퇴근 등록 실패')
    }

    return NextResponse.json({ ok: true, checkedOutAt: nowIso })
  } catch (e: any) {
    const firstIssue = e?.issues?.[0]
    if (firstIssue?.message) {
      return NextResponse.json({ error: firstIssue.message }, { status: 500 })
    }
    return errorResponse(e, '퇴근 등록 실패')
  }
}
