import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { supabaseAdmin } = await requireAdmin(token)

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'day'

    const now = new Date()
    const startDate = new Date(now)
    if (period === 'week') startDate.setDate(now.getDate() - 6)
    if (period === 'month') startDate.setDate(now.getDate() - 29)
    const start = startDate.toISOString().slice(0, 10)

    const { data: users, error: userError } = await supabaseAdmin
      .from('crm_users')
      .select('id, name, role_type, employment_status')
      .order('name', { ascending: true })

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    const { data: days, error: daysError } = await supabaseAdmin
      .from('attendance_days')
      .select('id, user_id, work_date, attendance_status, check_in_at, check_out_at')
      .gte('work_date', start)
      .order('work_date', { ascending: false })

    if (daysError) {
      return NextResponse.json({ error: daysError.message }, { status: 500 })
    }

    const dayIds = (days || []).map((day) => day.id)
    const { data: events, error: eventsError } = dayIds.length
      ? await supabaseAdmin
          .from('attendance_events')
          .select('id, attendance_day_id, event_type, occurred_at, source, note')
          .in('attendance_day_id', dayIds)
          .order('occurred_at', { ascending: false })
      : { data: [], error: null as any }

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 500 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const todayDays = (days || []).filter((day) => day.work_date === today)
    const todayStatusBuckets = {
      present: [] as string[],
      late: [] as string[],
      vacation: [] as string[],
      early_leave: [] as string[],
      not_registered: [] as string[]
    }

    for (const user of users || []) {
      const todayDay = todayDays.find((day) => day.user_id === user.id)
      if (!todayDay || todayDay.attendance_status === 'not_started') {
        todayStatusBuckets.not_registered.push(user.name)
      } else if (todayDay.attendance_status === 'present') {
        todayStatusBuckets.present.push(user.name)
      } else if (todayDay.attendance_status === 'late') {
        todayStatusBuckets.late.push(user.name)
      } else if (todayDay.attendance_status === 'vacation') {
        todayStatusBuckets.vacation.push(user.name)
      } else if (todayDay.attendance_status === 'early_leave') {
        todayStatusBuckets.early_leave.push(user.name)
      }
    }

    return NextResponse.json({
      period,
      startDate: start,
      users: users || [],
      days: days || [],
      events: events || [],
      todayStatusBuckets
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '근태 조회 실패' }, { status: 500 })
  }
}
