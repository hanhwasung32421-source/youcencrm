import { NextResponse } from 'next/server'
import { getProfileByAccessToken } from '@/lib/auth/session'
import { getKstYmd, isLateCheckIn } from '@/lib/attendance/time'
import { TABLES } from '@/lib/supabase/tables'
import { errorResponse } from '@/lib/api/error-response'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { profile, supabaseAdmin } = await getProfileByAccessToken(token)
    const today = getKstYmd(new Date())
    const nowIso = new Date().toISOString()

    const { data: existingDay } = await supabaseAdmin
      .from(TABLES.attendanceDays)
      .select('id, attendance_status, check_in_at, check_out_at')
      .eq('user_id', profile.id)
      .eq('work_date', today)
      .maybeSingle()

    if (existingDay?.check_in_at) {
      return NextResponse.json({ ok: true, checkedInAt: existingDay.check_in_at })
    }

    if (existingDay?.id) {
      const nextStatus = isLateCheckIn(nowIso, today) ? 'late' : existingDay.attendance_status === 'late' ? 'late' : 'present'
      const { data: updatedRows, error: updateError } = await supabaseAdmin
        .from(TABLES.attendanceDays)
        .update({
          attendance_status: nextStatus,
          check_in_at: nowIso,
          check_out_at: null,
          worked_minutes: 0,
          updated_at: nowIso
        })
        .eq('id', existingDay.id)
        .is('check_in_at', null)
        .select('id')

      if (updateError) {
        return errorResponse(updateError, '출근 등록 실패')
      }

      // 동시 요청이 먼저 체크인을 반영했다면(위 필터에 안 걸려 0행 갱신) 그 결과를 그대로 인정한다.
      if (!updatedRows?.length) {
        const { data: raceWinner } = await supabaseAdmin
          .from(TABLES.attendanceDays)
          .select('check_in_at')
          .eq('id', existingDay.id)
          .maybeSingle()
        return NextResponse.json({ ok: true, checkedInAt: raceWinner?.check_in_at || nowIso })
      }

      await supabaseAdmin.from(TABLES.attendanceEvents).insert({
        attendance_day_id: existingDay.id,
        event_type: nextStatus,
        occurred_at: nowIso,
        source: 'manual',
        note: '본인 출근 등록'
      })

      await supabaseAdmin.from(TABLES.auditLogs).insert({
        actor_user_id: profile.id,
        action_type: 'check_in',
        target_type: 'attendance_day',
        target_id: existingDay.id,
        diff_summary: { work_date: today, check_in_at: nowIso }
      })

      return NextResponse.json({ ok: true, checkedInAt: nowIso })
    }

    const { data: createdDay, error: createError } = await supabaseAdmin
      .from(TABLES.attendanceDays)
      .insert({
        user_id: profile.id,
        work_date: today,
        attendance_status: isLateCheckIn(nowIso, today) ? 'late' : 'present',
        check_in_at: nowIso,
        updated_at: nowIso
      })
      .select('id')
      .single()

    if (createError) {
      // unique(user_id, work_date) 위반 = 동시에 들어온 다른 출근 요청이 먼저 이겼다는 뜻.
      // 에러로 처리하지 않고, 먼저 기록된 출근 시간을 그대로 돌려준다(멱등 처리).
      if (createError.code === '23505') {
        const { data: raceWinner } = await supabaseAdmin
          .from(TABLES.attendanceDays)
          .select('check_in_at')
          .eq('user_id', profile.id)
          .eq('work_date', today)
          .maybeSingle()
        if (raceWinner?.check_in_at) {
          return NextResponse.json({ ok: true, checkedInAt: raceWinner.check_in_at })
        }
      }
      return errorResponse(createError, '출근 등록 실패')
    }
    if (!createdDay) {
      return NextResponse.json({ error: '출근 등록 실패' }, { status: 500 })
    }

    await supabaseAdmin.from(TABLES.attendanceEvents).insert({
      attendance_day_id: createdDay.id,
      event_type: isLateCheckIn(nowIso, today) ? 'late' : 'present',
      occurred_at: nowIso,
      source: 'manual',
      note: '본인 출근 등록'
    })

    await supabaseAdmin.from(TABLES.auditLogs).insert({
      actor_user_id: profile.id,
      action_type: 'check_in',
      target_type: 'attendance_day',
      target_id: createdDay.id,
      diff_summary: { work_date: today, check_in_at: nowIso }
    })

    return NextResponse.json({ ok: true, checkedInAt: nowIso })
  } catch (e: any) {
    return errorResponse(e, '출근 등록 실패')
  }
}
