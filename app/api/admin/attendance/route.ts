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

    return NextResponse.json({
      period,
      startDate: start,
      users: users || [],
      days: days || []
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '근태 조회 실패' }, { status: 500 })
  }
}

