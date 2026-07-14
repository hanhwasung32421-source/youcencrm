import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

function isValidDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { supabaseAdmin } = await requireAdmin(token)

    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    const today = new Date().toISOString().slice(0, 10)
    const dayStart = `${today}T00:00:00.000Z`

    const startDateValue = isValidDate(startDate) ? startDate! : `${new Date().getFullYear()}-01-01`
    const endDateValue = isValidDate(endDate) ? endDate! : `${new Date().getFullYear()}-12-31`
    const periodStartIso = `${startDateValue}T00:00:00.000Z`
    const periodEndIso = `${endDateValue}T23:59:59.999Z`

    const { count: videoCount } = await supabaseAdmin
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dayStart)

    const { count: unknownIpCount } = await supabaseAdmin
      .from('login_events')
      .select('*', { count: 'exact', head: true })
      .eq('network_zone_type', 'unknown')
      .gte('logged_in_at', dayStart)

    const { data: latest } = await supabaseAdmin
      .from('videos')
      .select('id, title, stock_name, content_type, view_count, published_at, created_at, duration_seconds, primary_owner_user_id, youtube_url')
      .order('created_at', { ascending: false })
      .limit(10)

    const since = new Date()
    since.setDate(since.getDate() - 6)
    const sinceIso = since.toISOString()

    const { data: recentVideos } = await supabaseAdmin
      .from('videos')
      .select('id, title, content_type, view_count, duration_seconds, created_at, primary_owner_user_id')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })

    const { count: longformCount } = await supabaseAdmin
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('content_type', 'longform')

    const { count: shortformCount } = await supabaseAdmin
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('content_type', 'shortform')

    const { data: allUsers } = await supabaseAdmin
      .from('crm_users')
      .select('id, name, employment_status')
      .neq('employment_status', 'inactive')

    const { data: periodVideos } = await supabaseAdmin
      .from('videos')
      .select('id, primary_owner_user_id, created_at, duration_seconds, view_count')
      .gte('created_at', periodStartIso)
      .lte('created_at', periodEndIso)

    const dayLabels = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      const key = date.toISOString().slice(0, 10)
      return {
        key,
        label: `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`,
        value: 0
      }
    })

    for (const row of recentVideos || []) {
      const key = String(row.created_at || '').slice(0, 10)
      const target = dayLabels.find((item) => item.key === key)
      if (target) target.value += 1
    }

    const userNameMap = Object.fromEntries((allUsers || []).map((user) => [user.id, user.name]))
    const todayKey = today
    const efficiencyMap = new Map<
      string,
      { userId: string; name: string; todayCount: number; periodCount: number; totalDurationSeconds: number; totalViews: number }
    >()

    for (const user of allUsers || []) {
      efficiencyMap.set(user.id, {
        userId: user.id,
        name: user.name,
        todayCount: 0,
        periodCount: 0,
        totalDurationSeconds: 0,
        totalViews: 0
      })
    }

    // 오늘 등록 수는 전체에서 계산 (기간과 별개)
    for (const row of recentVideos || []) {
      const ownerId = row.primary_owner_user_id
      if (!ownerId) continue
      if (!efficiencyMap.has(ownerId)) {
        efficiencyMap.set(ownerId, {
          userId: ownerId,
          name: userNameMap[ownerId] || '이름 없음',
          todayCount: 0,
          periodCount: 0,
          totalDurationSeconds: 0,
          totalViews: 0
        })
      }
      const item = efficiencyMap.get(ownerId)!
      const createdDate = String(row.created_at || '').slice(0, 10)
      if (createdDate === todayKey) item.todayCount += 1
    }

    // 기간 집계 (기간 등록 수/기간 업로드 시간/기간 조회수)
    for (const video of periodVideos || []) {
      const ownerId = video.primary_owner_user_id
      if (!ownerId) continue
      if (!efficiencyMap.has(ownerId)) {
        efficiencyMap.set(ownerId, {
          userId: ownerId,
          name: userNameMap[ownerId] || '이름 없음',
          todayCount: 0,
          periodCount: 0,
          totalDurationSeconds: 0,
          totalViews: 0
        })
      }

      const item = efficiencyMap.get(ownerId)!
      item.periodCount += 1
      item.totalDurationSeconds += video.duration_seconds || 0
      item.totalViews += video.view_count || 0
    }

    const employeeEfficiency = Array.from(efficiencyMap.values()).sort((a, b) => {
      if (b.todayCount !== a.todayCount) return b.todayCount - a.todayCount
      if (b.periodCount !== a.periodCount) return b.periodCount - a.periodCount
      return b.totalViews - a.totalViews
    })

    const ownerLabel = (ownerId: string | null) => {
      if (!ownerId) return '담당 없음'
      return userNameMap[ownerId] || '이름 없음'
    }

    const groupSum = (rows: any[], valueKey: string) => {
      const map = new Map<string, number>()
      for (const row of rows) {
        const label = ownerLabel(row.primary_owner_user_id)
        const value = Number(row[valueKey] || 0)
        map.set(label, (map.get(label) || 0) + (Number.isFinite(value) ? value : 0))
      }
      return Array.from(map.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
        .reverse()
    }

    return NextResponse.json({
      todayRegisteredCount: videoCount || 0,
      unknownIpCount: unknownIpCount || 0,
      period: { startDate: startDateValue, endDate: endDateValue },
      latest: (latest || []).map((item) => ({
        ...item,
        owner_name: ownerLabel(item.primary_owner_user_id)
      })),
      charts: {
        viewByLatest: groupSum(latest || [], 'view_count'),
        durationByLatest: groupSum(latest || [], 'duration_seconds'),
        dailyRegistrations: dayLabels.map((item) => ({
          label: item.label,
          value: item.value
        })),
        contentTypes: [
          { label: '롱폼', value: longformCount || 0 },
          { label: '숏폼', value: shortformCount || 0 }
        ],
        employeeTodayCounts: employeeEfficiency.slice(0, 8).map((item) => ({
          label: item.name,
          value: item.todayCount
        })),
        employeePeriodCounts: employeeEfficiency.slice(0, 8).map((item) => ({
          label: item.name,
          value: item.periodCount
        })),
        employeeTotalDurations: employeeEfficiency.slice(0, 8).map((item) => ({
          label: item.name,
          value: item.totalDurationSeconds
        }))
      },
      employeeEfficiency
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '관리자 대시보드 조회 실패' }, { status: 500 })
  }
}
