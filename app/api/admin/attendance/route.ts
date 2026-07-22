import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getAttendancePeriodRange, getAttendanceWorkedSeconds } from '@/lib/attendance'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { supabaseAdmin } = await requireAdmin(token)

    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || 'day') as 'day' | 'week' | 'month'
    const { startYmd, endYmd } = getAttendancePeriodRange(period)

    const { data: users, error: userError } = await supabaseAdmin
      .from('crm_users')
      .select('id, name, role_type, employment_status')
      .neq('employment_status', 'inactive')
      .order('name', { ascending: true })

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    const { data: days, error: daysError } = await supabaseAdmin
      .from('attendance_days')
      .select('id, user_id, work_date, attendance_status, check_in_at, check_out_at, worked_minutes')
      .gte('work_date', startYmd)
      .lte('work_date', endYmd)
      .order('work_date', { ascending: false })

    if (daysError) {
      return NextResponse.json({ error: daysError.message }, { status: 500 })
    }

    return NextResponse.json({
      period,
      startDate: startYmd,
      endDate: endYmd,
      users: users || [],
      rows: (users || []).map((user) => {
        const userDays = (days || []).filter((day) => day.user_id === user.id)
        const firstCheckIn = userDays
          .filter((day) => day.check_in_at)
          .map((day) => day.check_in_at as string)
          .sort()[0] || null
        const lastCheckOut =
          userDays
            .filter((day) => day.check_out_at)
            .map((day) => day.check_out_at as string)
            .sort()
            .slice(-1)[0] || null
        const workedSeconds = userDays.reduce(
          (sum, day) => sum + getAttendanceWorkedSeconds(day.check_in_at, day.check_out_at),
          0
        )
        const latestDay = userDays[0] || null
        return {
          userId: user.id,
          name: user.name,
          roleType: user.role_type,
          attendanceStatus: latestDay?.attendance_status || 'not_started',
          checkInAt: period === 'day' ? latestDay?.check_in_at || null : firstCheckIn,
          checkOutAt: period === 'day' ? latestDay?.check_out_at || null : lastCheckOut,
          workedSeconds
        }
      })
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '근태 조회 실패' }, { status: 500 })
  }
}
