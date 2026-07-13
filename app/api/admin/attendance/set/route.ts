import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'

const bodySchema = z.object({
  accessToken: z.string().min(10),
  userId: z.string().uuid(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendanceStatus: z.enum(['present', 'late', 'vacation', 'early_leave'])
})

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const { profile, supabaseAdmin } = await requireAdmin(body.accessToken)
    const nowIso = new Date().toISOString()

    const { data: day, error: upsertError } = await supabaseAdmin
      .from('attendance_days')
      .upsert(
        {
          user_id: body.userId,
          work_date: body.workDate,
          attendance_status: body.attendanceStatus,
          check_in_at: ['present', 'late'].includes(body.attendanceStatus) ? nowIso : null,
          check_out_at: body.attendanceStatus === 'early_leave' ? nowIso : null,
          updated_at: nowIso
        },
        { onConflict: 'user_id,work_date' }
      )
      .select('id')
      .single()

    if (upsertError || !day) {
      return NextResponse.json({ error: upsertError?.message || '근태 저장 실패' }, { status: 500 })
    }

    const { error: eventError } = await supabaseAdmin.from('attendance_events').insert({
      attendance_day_id: day.id,
      event_type: body.attendanceStatus,
      occurred_at: nowIso,
      source: 'admin',
      note: '관리자 근태 등록'
    })

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 })
    }

    await supabaseAdmin.from('audit_logs').insert({
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

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '근태 등록 실패' }, { status: 500 })
  }
}

