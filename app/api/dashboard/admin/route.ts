import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getAutoCheckoutIso } from '@/lib/attendance'

function isValidYmd(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function getKstParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  const y = Number(parts.year)
  const m = Number(parts.month)
  const d = Number(parts.day)
  const weekday = String(parts.weekday || '')
  return { y, m, d, ymd: `${parts.year}-${parts.month}-${parts.day}`, weekday }
}

function kstDayStartUtcIso(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  const utcMillis = Date.UTC(y, m - 1, d, 0, 0, 0) - 9 * 60 * 60 * 1000
  return new Date(utcMillis).toISOString()
}

function kstDayEndUtcIso(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  const nextDayUtcMillis = Date.UTC(y, m - 1, d + 1, 0, 0, 0) - 9 * 60 * 60 * 1000
  return new Date(nextDayUtcMillis - 1).toISOString()
}

function addDaysKst(ymd: string, deltaDays: number) {
  const [y, m, d] = ymd.split('-').map(Number)
  const baseUtcMillis = Date.UTC(y, m - 1, d, 12, 0, 0) - 9 * 60 * 60 * 1000
  const shifted = new Date(baseUtcMillis + deltaDays * 24 * 60 * 60 * 1000)
  return getKstParts(shifted).ymd
}

function getWeekRangeKst(todayYmd: string) {
  const weekdayShort = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(
    new Date()
  )
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const dow = map[weekdayShort] ?? 0
  const diffToMon = (dow + 6) % 7
  const start = addDaysKst(todayYmd, -diffToMon)
  const end = addDaysKst(start, 6)
  return { start, end }
}

function getMonthRangeKst(y: number, m: number) {
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

type Bucket = { count: number; durationSeconds: number; views: number; afterCheckInCount?: number; afterCheckOutCount?: number }

function addBucket(target: Bucket, row: any) {
  target.count += 1
  target.durationSeconds += Number(row.duration_seconds || 0)
  target.views += Number(row.view_count || 0)
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { supabaseAdmin } = await requireAdmin(token)

    const url = new URL(request.url)
    const searchStart = url.searchParams.get('searchStart')
    const searchEnd = url.searchParams.get('searchEnd')

    // 3) 검색 모드: 직원별 기간 표 반환
    if (isValidYmd(searchStart) && isValidYmd(searchEnd)) {
      const startIso = kstDayStartUtcIso(searchStart!)
      const endIso = kstDayEndUtcIso(searchEnd!)
      const { data: users, error: usersError } = await supabaseAdmin
        .from('crm_users')
        .select('id, name, employment_status')
        .neq('employment_status', 'inactive')
        .order('name', { ascending: true })

      if (usersError) {
        return NextResponse.json({ error: usersError.message }, { status: 500 })
      }

      const { data: videos, error } = await supabaseAdmin
        .from('videos')
        .select('primary_owner_user_id, duration_seconds, view_count')
        .gte('created_at', startIso)
        .lte('created_at', endIso)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const summary: Bucket = { count: 0, durationSeconds: 0, views: 0 }
      const rows = (users || []).map((user) => ({
        userId: user.id,
        name: user.name,
        period: { count: 0, durationSeconds: 0, views: 0 } as Bucket
      }))
      const rowMap = new Map(rows.map((row) => [row.userId, row]))

      for (const video of videos || []) {
        addBucket(summary, video)
        const ownerId = video.primary_owner_user_id
        if (!ownerId) continue
        const target = rowMap.get(ownerId)
        if (target) addBucket(target.period, video)
      }

      return NextResponse.json({
        mode: 'search',
        period: { startDate: searchStart, endDate: searchEnd },
        summary,
        rows: rows.sort((a, b) => b.period.count - a.period.count)
      })
    }

    // 2) 기본 표 모드: 오늘/주/월/년 집계
    const kstNow = getKstParts(new Date())
    const today = kstNow.ymd
    const week = getWeekRangeKst(today)
    const month = getMonthRangeKst(kstNow.y, kstNow.m)
    const yearStart = `${kstNow.y}-01-01`
    const yearEnd = `${kstNow.y}-12-31`

    const yearStartIso = kstDayStartUtcIso(yearStart)
    const yearEndIso = kstDayEndUtcIso(yearEnd)

    const { data: users, error: usersError } = await supabaseAdmin
      .from('crm_users')
      .select('id, name, employment_status')
      .neq('employment_status', 'inactive')
      .order('name', { ascending: true })

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    const { data: yearVideos, error: videosError } = await supabaseAdmin
      .from('videos')
      .select('primary_owner_user_id, created_at, duration_seconds, view_count')
      .gte('created_at', yearStartIso)
      .lte('created_at', yearEndIso)

    if (videosError) {
      return NextResponse.json({ error: videosError.message }, { status: 500 })
    }

    const rangeToIso = (range: { start: string; end: string }) => ({
      startIso: kstDayStartUtcIso(range.start),
      endIso: kstDayEndUtcIso(range.end)
    })
    const todayIso = rangeToIso({ start: today, end: today })
    const weekIso = rangeToIso(week)
    const monthIso = rangeToIso(month)

    const makeRow = (user: any) => ({
      userId: user.id,
      name: user.name,
      today: { count: 0, durationSeconds: 0, views: 0, afterCheckInCount: 0, afterCheckOutCount: 0 } as Bucket,
      week: { count: 0, durationSeconds: 0, views: 0, afterCheckInCount: 0, afterCheckOutCount: 0 } as Bucket,
      month: { count: 0, durationSeconds: 0, views: 0, afterCheckInCount: 0, afterCheckOutCount: 0 } as Bucket,
      year: { count: 0, durationSeconds: 0, views: 0, afterCheckInCount: 0, afterCheckOutCount: 0 } as Bucket
    })

    const rowMap = new Map<string, ReturnType<typeof makeRow>>()
    for (const user of users || []) {
      rowMap.set(user.id, makeRow(user))
    }

    for (const video of yearVideos || []) {
      const ownerId = video.primary_owner_user_id
      if (!ownerId) continue
      if (!rowMap.has(ownerId)) {
        rowMap.set(ownerId, makeRow({ id: ownerId, name: '이름 없음' }))
      }
      const row = rowMap.get(ownerId)!

      addBucket(row.year, video)

      const createdAt = String(video.created_at || '')
      if (createdAt >= monthIso.startIso && createdAt <= monthIso.endIso) addBucket(row.month, video)
      if (createdAt >= weekIso.startIso && createdAt <= weekIso.endIso) addBucket(row.week, video)
      if (createdAt >= todayIso.startIso && createdAt <= todayIso.endIso) addBucket(row.today, video)
    }

    const { data: attendanceDays } = await supabaseAdmin
      .from('attendance_days')
      .select('user_id, work_date, check_in_at, check_out_at')
      .gte('work_date', yearStart)
      .lte('work_date', yearEnd)

    const attendanceMap = new Map(
      (attendanceDays || []).map((item) => [
        `${item.user_id}:${item.work_date}`,
        {
          checkInAt: item.check_in_at || null,
          checkOutAt: item.check_out_at || getAutoCheckoutIso(item.work_date)
        }
      ])
    )

    for (const video of yearVideos || []) {
      const ownerId = video.primary_owner_user_id
      if (!ownerId) continue
      const row = rowMap.get(ownerId)
      if (!row) continue
      const createdAt = String(video.created_at || '')
      const createdYmd = createdAt.slice(0, 10)
      const attendance = attendanceMap.get(`${ownerId}:${createdYmd}`)
      if (!attendance?.checkInAt) continue

      const addAfterCounts = (bucket: Bucket) => {
        if (attendance.checkOutAt && createdAt > attendance.checkOutAt) {
          bucket.afterCheckOutCount = (bucket.afterCheckOutCount || 0) + 1
          return
        }
        bucket.afterCheckInCount = (bucket.afterCheckInCount || 0) + 1
      }

      if (createdAt >= todayIso.startIso && createdAt <= todayIso.endIso) addAfterCounts(row.today)
      if (createdAt >= weekIso.startIso && createdAt <= weekIso.endIso) addAfterCounts(row.week)
      if (createdAt >= monthIso.startIso && createdAt <= monthIso.endIso) addAfterCounts(row.month)
      if (createdAt >= yearStartIso && createdAt <= yearEndIso) addAfterCounts(row.year)
    }

    const rows = Array.from(rowMap.values()).sort((a, b) => b.today.count - a.today.count)

    return NextResponse.json({
      mode: 'table',
      buckets: { today: { start: today, end: today }, week, month, year: { start: yearStart, end: yearEnd } },
      rows
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '관리자 대시보드 조회 실패' }, { status: 500 })
  }
}
