import { NextResponse } from 'next/server'
import { getProfileByAccessToken } from '@/lib/auth'
import { getKstYmd, isLateCheckIn } from '@/lib/attendance'

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

    if (existingDay?.check_in_at) {
      return NextResponse.json({ ok: true, checkedInAt: existingDay.check_in_at })
    }

    if (existingDay?.id) {
      const nextStatus = isLateCheckIn(nowIso, today) ? 'late' : existingDay.attendance_status === 'late' ? 'late' : 'present'
      const { error: updateError } = await supabaseAdmin
        .from('attendance_days')
        .update({
          attendance_status: nextStatus,
          check_in_at: nowIso,
          check_out_at: null,
          worked_minutes: 0,
          updated_at: nowIso
        })
        .eq('id', existingDay.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      await supabaseAdmin.from('attendance_events').insert({
        attendance_day_id: existingDay.id,
        event_type: nextStatus,
        occurred_at: nowIso,
        source: 'manual',
        note: '본인 출근 등록'
      })

      await supabaseAdmin.from('audit_logs').insert({
        actor_user_id: profile.id,
        action_type: 'check_in',
        target_type: 'attendance_day',
        target_id: existingDay.id,
        diff_summary: { work_date: today, check_in_at: nowIso }
      })

      return NextResponse.json({ ok: true, checkedInAt: nowIso })
    }

    const { data: createdDay, error: createError } = await supabaseAdmin
      .from('attendance_days')
      .insert({
        user_id: profile.id,
        work_date: today,
        attendance_status: isLateCheckIn(nowIso, today) ? 'late' : 'present',
        check_in_at: nowIso,
        updated_at: nowIso
      })
      .select('id')
      .single()

    if (createError || !createdDay) {
      return NextResponse.json({ error: createError?.message || '출근 등록 실패' }, { status: 500 })
    }

    await supabaseAdmin.from('attendance_events').insert({
      attendance_day_id: createdDay.id,
      event_type: isLateCheckIn(nowIso, today) ? 'late' : 'present',
      occurred_at: nowIso,
      source: 'manual',
      note: '본인 출근 등록'
    })

    await supabaseAdmin.from('audit_logs').insert({
      actor_user_id: profile.id,
      action_type: 'check_in',
      target_type: 'attendance_day',
      target_id: createdDay.id,
      diff_summary: { work_date: today, check_in_at: nowIso }
    })

    return NextResponse.json({ ok: true, checkedInAt: nowIso })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '출근 등록 실패' }, { status: 500 })
  }
}
