import { NextResponse } from 'next/server'
import { getProfileByAccessToken } from '@/lib/auth'
import { getAttendanceWorkedSeconds, getAutoCheckoutIso, getKstYmd } from '@/lib/attendance'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { profile, supabaseAdmin } = await getProfileByAccessToken(token)
    const today = getKstYmd(new Date())

    const { data: day, error } = await supabaseAdmin
      .from('attendance_days')
      .select('id, work_date, attendance_status, check_in_at, check_out_at, worked_minutes')
      .eq('user_id', profile.id)
      .eq('work_date', today)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (day?.id && day.check_in_at && !day.check_out_at) {
      const autoCheckoutAt = getAutoCheckoutIso(today)
      if (new Date() >= new Date(autoCheckoutAt)) {
        const workedSeconds = getAttendanceWorkedSeconds(day.check_in_at, autoCheckoutAt)
        await supabaseAdmin
          .from('attendance_days')
          .update({
            check_out_at: autoCheckoutAt,
            worked_minutes: Math.floor(workedSeconds / 60),
            updated_at: autoCheckoutAt
          })
          .eq('id', day.id)

        await supabaseAdmin.from('attendance_events').insert({
          attendance_day_id: day.id,
          event_type: 'correction',
          occurred_at: autoCheckoutAt,
          source: 'system',
          note: '23:59 자동 퇴근 처리'
        })

        await supabaseAdmin.from('audit_logs').insert({
          actor_user_id: profile.id,
          action_type: 'auto_check_out',
          target_type: 'attendance_day',
          target_id: day.id,
          diff_summary: {
            work_date: today,
            check_out_at: autoCheckoutAt,
            worked_minutes: Math.floor(workedSeconds / 60)
          }
        })

        return NextResponse.json({
          workDate: today,
          attendanceStatus: day.attendance_status || 'not_started',
          checkInAt: day.check_in_at || null,
          checkOutAt: autoCheckoutAt,
          workedSeconds,
          isWorking: false
        })
      }
    }

    const workedSeconds = getAttendanceWorkedSeconds(day?.check_in_at || null, day?.check_out_at || null)
    return NextResponse.json({
      workDate: today,
      attendanceStatus: day?.attendance_status || 'not_started',
      checkInAt: day?.check_in_at || null,
      checkOutAt: day?.check_out_at || null,
      workedSeconds,
      isWorking: Boolean(day?.check_in_at && !day?.check_out_at)
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '근태 상태 조회 실패' }, { status: 500 })
  }
}
