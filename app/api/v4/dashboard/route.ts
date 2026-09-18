import { NextResponse } from 'next/server'
import { getKstDayStartIso } from '@/lib/attendance/time'
import { computeDailySeries, computeKpis, getPeriodRange, num, parsePeriod, rankVideos } from '@/lib/v4/analytics'
import { getSampleGoal } from '@/lib/v4/sample-data'
import { loadUsers, loadVideos, requireV4User, v4ErrorResponse } from '@/lib/v4/server'
import { V4_TABLES, isMissingTableError } from '@/lib/v4/tables'

const TARGET_PER_STAFF_PER_DAY = 12

export async function GET(request: Request) {
  try {
    const { profile, supabaseAdmin, isAdmin } = await requireV4User(request)
    const url = new URL(request.url)
    const range = getPeriodRange(parsePeriod(url.searchParams.get('period')))
    const ownerId = isAdmin ? null : profile.id
    const month = range.endYmd.slice(0, 7)
    const monthStartIso = getKstDayStartIso(`${month}-01`)

    const [videos, feedVideos, { map: userMap, staff }, monthVideos, syncRow, goalResult] = await Promise.all([
      loadVideos(supabaseAdmin, { startIso: range.startIso, endIso: range.endIso, ownerId }),
      loadVideos(supabaseAdmin, { ownerId, limit: 20 }),
      loadUsers(supabaseAdmin),
      (async () => {
        let q = supabaseAdmin.from(V4_TABLES.videos).select('view_count').gte('created_at', monthStartIso).lte('created_at', range.endIso)
        if (ownerId) q = q.eq('primary_owner_user_id', ownerId)
        const { data, error } = await q
        if (error) throw new Error(error.message)
        return (data || []) as Array<{ view_count: number | null }>
      })(),
      (async () => {
        let q = supabaseAdmin
          .from(V4_TABLES.videos)
          .select('last_synced_at')
          .not('last_synced_at', 'is', null)
          .order('last_synced_at', { ascending: false })
          .limit(1)
        if (ownerId) q = q.eq('primary_owner_user_id', ownerId)
        const { data } = await q
        return (data?.[0]?.last_synced_at as string | undefined) || null
      })(),
      supabaseAdmin
        .from(V4_TABLES.growthGoals)
        .select('id, month, user_id, target_videos, target_views')
        .eq('month', month)
    ])

    const staffCount = staff.length
    const kpis = computeKpis(videos)
    const daily = computeDailySeries(videos, range.startYmd, range.endYmd)
    const feed = rankVideos(feedVideos, userMap).map((v) => ({
      id: v.id,
      title: v.title,
      stockName: v.stockName,
      ownerName: v.ownerName,
      contentType: v.contentType,
      viewCount: v.viewCount,
      createdAt: v.createdAt,
      thumbnailUrl: v.thumbnailUrl,
      youtubeUrl: v.youtubeUrl
    }))

    // 목표 대비: 팀 목표(user_id null) / 개인 목표 / 팀 목표를 인원수로 나눈 환산값
    let sample = false
    let goalRows: Array<{ user_id: string | null; target_videos: number; target_views: number }> = []
    if (goalResult.error) {
      if (!isMissingTableError(goalResult.error)) throw new Error(goalResult.error.message)
      sample = true
      const sampleGoal = getSampleGoal(month, staffCount)
      goalRows = [{ user_id: null, target_videos: sampleGoal.targetVideos, target_views: sampleGoal.targetViews }]
    } else {
      goalRows = (goalResult.data || []) as typeof goalRows
    }
    const teamGoal = goalRows.find((g) => g.user_id === null) || null
    const ownGoal = goalRows.find((g) => g.user_id === profile.id) || null
    let scope: 'team' | 'user' | 'derived' | 'none' = 'none'
    let targetVideos = 0
    let targetViews = 0
    if (isAdmin) {
      if (teamGoal) {
        scope = 'team'
        targetVideos = num(teamGoal.target_videos)
        targetViews = num(teamGoal.target_views)
      }
    } else if (ownGoal) {
      scope = 'user'
      targetVideos = num(ownGoal.target_videos)
      targetViews = num(ownGoal.target_views)
    } else if (teamGoal) {
      scope = 'derived'
      const divisor = Math.max(staffCount, 1)
      targetVideos = Math.round(num(teamGoal.target_videos) / divisor)
      targetViews = Math.round(num(teamGoal.target_views) / divisor)
    }
    const actualVideos = monthVideos.length
    const actualViews = monthVideos.reduce((sum, v) => sum + num(v.view_count), 0)

    return NextResponse.json({
      scope: isAdmin ? 'admin' : 'staff',
      period: range.days,
      range: { start: range.startYmd, end: range.endYmd },
      staffCount,
      targetPerDay: (isAdmin ? Math.max(staffCount, 1) : 1) * TARGET_PER_STAFF_PER_DAY,
      kpis,
      daily,
      feed,
      lastSyncedAt: syncRow,
      goal: {
        month,
        scope,
        targetVideos,
        targetViews,
        actualVideos,
        actualViews,
        teamGoal: teamGoal ? { targetVideos: num(teamGoal.target_videos), targetViews: num(teamGoal.target_views) } : null,
        sample
      }
    })
  } catch (e) {
    return v4ErrorResponse(e, '성장 대시보드 조회 실패')
  }
}
