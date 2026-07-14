import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'

const bodySchema = z.object({
  accessToken: z.string().min(10),
  userId: z.string().uuid(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
})

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const { supabaseAdmin } = await requireAdmin(body.accessToken)
    const nowIso = new Date().toISOString()

    const { data: existingDay } = await supabaseAdmin
      .from('attendance_days')
      .select('id, attendance_status')
      .eq('user_id', body.userId)
      .eq('work_date', body.workDate)
      .maybeSingle()

    let dayId = existingDay?.id

    if (!dayId) {
      const { data: createdDay, error: createError } = await supabaseAdmin
        .from('attendance_days')
        .insert({
          user_id: body.userId,
          work_date: body.workDate,
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
      source: 'admin',
      note: '관리자 퇴근 등록'
    })

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, checkedOutAt: nowIso })
  } catch (e: any) {
    const firstIssue = e?.issues?.[0]
    return NextResponse.json({ error: firstIssue?.message || e?.message || '퇴근 등록 실패' }, { status: 500 })
  }
}

