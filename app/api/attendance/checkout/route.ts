import { NextResponse } from 'next/server'
import { getProfileByAccessToken } from '@/lib/auth'
import { getAttendanceWorkedSeconds, getKstYmd } from '@/lib/attendance'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { profile, supabaseAdmin } = await getProfileByAccessToken(token)
    const today = getKstYmd(new Date())
    const nowIso = new Date().toISOString()

    const { data: existingDay } = await supabaseAdmin
      .from('attendance_days')
      .select('id, attendance_status, check_in_at, check_out_at')
      .eq('user_id', profile.id)
      .eq('work_date', today)
      .maybeSingle()

    if (!existingDay?.id || !existingDay.check_in_at) {
      return NextResponse.json({ error: '출근 등록 후 퇴근할 수 있습니다.' }, { status: 400 })
    }
    if (existingDay.check_out_at) {
      return NextResponse.json({ ok: true, checkedOutAt: existingDay.check_out_at }, { status: 200 })
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

    const { error: eventError } = await supabaseAdmin.from('attendance_events').insert({
      attendance_day_id: existingDay.id,
      event_type: 'correction',
      occurred_at: nowIso,
      source: 'manual',
      note: '본인 퇴근 등록'
    })

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 })
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_user_id: profile.id,
      action_type: 'check_out',
      target_type: 'attendance_day',
      target_id: existingDay.id,
      diff_summary: {
        work_date: today,
        check_out_at: nowIso,
        worked_minutes: Math.floor(workedSeconds / 60)
      }
    })

    return NextResponse.json({ ok: true, checkedOutAt: nowIso, workedSeconds })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '퇴근 등록 실패' }, { status: 500 })
  }
}
