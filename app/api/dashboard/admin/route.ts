import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const { supabaseAdmin } = await requireAdmin(token)

    const today = new Date().toISOString().slice(0, 10)
    const dayStart = `${today}T00:00:00.000Z`

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

    const { data: allVideos } = await supabaseAdmin
      .from('videos')
      .select('id, primary_owner_user_id, created_at, duration_seconds, view_count')
      .order('created_at', { ascending: false })

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

    for (const video of allVideos || []) {
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
      const createdDate = String(video.created_at || '').slice(0, 10)
      if (createdDate === todayKey) item.todayCount += 1
      if (video.created_at && String(video.created_at) >= sinceIso) item.periodCount += 1
      item.totalDurationSeconds += video.duration_seconds || 0
      item.totalViews += video.view_count || 0
    }

    const employeeEfficiency = Array.from(efficiencyMap.values()).sort((a, b) => {
      if (b.todayCount !== a.todayCount) return b.todayCount - a.todayCount
      if (b.periodCount !== a.periodCount) return b.periodCount - a.periodCount
      return b.totalViews - a.totalViews
    })

    return NextResponse.json({
      todayRegisteredCount: videoCount || 0,
      unknownIpCount: unknownIpCount || 0,
      latest: latest || [],
      charts: {
        viewByLatest: (latest || []).slice().reverse().map((item) => ({
          label: item.title || item.stock_name || '제목 없음',
          value: item.view_count || 0
        })),
        durationByLatest: (latest || []).slice().reverse().map((item) => ({
          label: item.title || item.stock_name || '제목 없음',
          value: item.duration_seconds || 0
        })),
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
