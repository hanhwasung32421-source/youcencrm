import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/api/error-response'
import { average, CONTENT_TYPE_LABELS, engagementRatePct, summarizeByFormat, type VideoLite, viewVelocity } from '@/lib/v3/engagement'
import { authenticate, isMissingTableError, loadScopedVideos, loadTeamVideos } from '@/lib/v3/server'
import { V3_TABLES } from '@/lib/v3/tables'
import { sampleSeriesRows } from '@/lib/v3/sample-data'

// 형식(롱폼 · 숏폼) 효과 + 시리즈 트래커
//   형식 효율 = 형식별 평균 참여율, 평균 조회 속도 (V4의 형식별 "건수" 비교와는 다른 지표)
//   시리즈 성과 = 시리즈에 속한 영상들의 평균 참여율 · 조회 속도를,
//                같은 종목의 시리즈 밖 영상(baseline)과 비교
export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin, profile, isAdmin } = auth

  try {
    const now = new Date()
    const staffId = new URL(request.url).searchParams.get('staffId')

    const [scopedVideos, teamVideos] = await Promise.all([
      loadScopedVideos(supabaseAdmin, { isAdmin, selfUserId: profile.id, staffId: isAdmin ? staffId : null, limit: 1500 }),
      loadTeamVideos(supabaseAdmin, { limit: 3000 })
    ])

    const formatStats = summarizeByFormat(scopedVideos, now)

    const seriesRes = await supabaseAdmin
      .from(V3_TABLES.videoSeries)
      .select('id, name, stock_name, created_by, created_at')
      .order('created_at', { ascending: false })

    let sample = false
    let seriesRows: { id: string; name: string; stock_name: string | null; created_by: string | null; created_at: string }[] = []
    const membersBySeries = new Map<string, string[]>()
    const memberVideoIds = new Set<string>()

    if (seriesRes.error) {
      if (!isMissingTableError(seriesRes.error)) throw new Error(seriesRes.error.message)
      sample = true
    } else {
      seriesRows = seriesRes.data || []
      if (seriesRows.length > 0) {
        const memberRes = await supabaseAdmin
          .from(V3_TABLES.videoSeriesMembers)
          .select('series_id, video_id')
          .in(
            'series_id',
            seriesRows.map((s) => s.id)
          )
        if (memberRes.error && !isMissingTableError(memberRes.error)) throw new Error(memberRes.error.message)
        for (const row of (memberRes.data || []) as { series_id: string; video_id: string }[]) {
          memberVideoIds.add(row.video_id)
          const list = membersBySeries.get(row.series_id) || []
          list.push(row.video_id)
          membersBySeries.set(row.series_id, list)
        }
      }
    }

    const videoById = new Map(teamVideos.map((v) => [v.id, v]))

    const series = sample
      ? sampleSeriesRows().map((r) => ({
          id: r.id,
          name: r.name,
          stockName: r.stock_name,
          videoCount: r.video_count,
          avgEngagementPct: r.avg_engagement_pct,
          avgVelocity: r.avg_velocity,
          baselineEngagementPct: r.baseline_engagement_pct,
          baselineVelocity: r.baseline_velocity
        }))
      : seriesRows.map((s) => {
          const memberIds = membersBySeries.get(s.id) || []
          const memberVideos = memberIds.map((id) => videoById.get(id)).filter((v): v is VideoLite => !!v)
          const engagementRates = memberVideos.map((v) => engagementRatePct(v)).filter((v): v is number => v !== null)
          const velocities = memberVideos.map((v) => viewVelocity(v, now))

          const baselinePool = teamVideos.filter((v) => !memberVideoIds.has(v.id) && (s.stock_name ? v.stock_name === s.stock_name : true))
          const baselineEngagement = average(baselinePool.map((v) => engagementRatePct(v)).filter((v): v is number => v !== null))
          const baselineVelocity = average(baselinePool.map((v) => viewVelocity(v, now)))

          return {
            id: s.id,
            name: s.name,
            stockName: s.stock_name,
            videoCount: memberVideos.length,
            avgEngagementPct: average(engagementRates),
            avgVelocity: average(velocities),
            baselineEngagementPct: baselineEngagement,
            baselineVelocity
          }
        })

    const eligibleVideos = scopedVideos
      .filter((v) => !memberVideoIds.has(v.id))
      .slice(0, 60)
      .map((v) => ({ id: v.id, title: v.title || v.stock_name || '(제목 없음)', stockName: v.stock_name, contentType: v.content_type }))

    return NextResponse.json({
      sample,
      formatStats: {
        longform: { label: CONTENT_TYPE_LABELS.longform, ...formatStats.longform },
        shortform: { label: CONTENT_TYPE_LABELS.shortform, ...formatStats.shortform }
      },
      series,
      eligibleVideos
    })
  } catch (e) {
    return errorResponse(e, '형식 · 시리즈 효과 분석에 실패했습니다.')
  }
}
