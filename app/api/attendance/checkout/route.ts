import { NextResponse } from 'next/server'
import { getProfileByAccessToken } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { profile, supabaseAdmin } = await getProfileByAccessToken(token)
    const today = new Date().toISOString().slice(0, 10)
    const nowIso = new Date().toISOString()

    const { data: existingDay } = await supabaseAdmin
      .from('attendance_days')
      .select('id, attendance_status')
      .eq('user_id', profile.id)
      .eq('work_date', today)
      .maybeSingle()

    let dayId = existingDay?.id

    if (!dayId) {
      const { data: createdDay, error: createError } = await supabaseAdmin
        .from('attendance_days')
        .insert({
          user_id: profile.id,
          work_date: today,
          attendance_status: 'present',
          check_out_at: nowIso,
          updated_at: nowIso
        })
        .select('id')
        .single()

      if (createError || !createdDay) {
        return NextResponse.json({ error: createError?.message || '퇴근 등록 실패' }, { status: 500 })
      }
      dayId = createdDay.id
    } else {
      const { error: updateError } = await supabaseAdmin
        .from('attendance_days')
        .update({
          check_out_at: nowIso,
          updated_at: nowIso
        })
        .eq('id', dayId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    const { error: eventError } = await supabaseAdmin.from('attendance_events').insert({
      attendance_day_id: dayId,
      event_type: 'correction',
      occurred_at: nowIso,
      source: 'manual',
      note: '본인 퇴근 등록'
    })

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, checkedOutAt: nowIso })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '퇴근 등록 실패' }, { status: 500 })
  }
}

