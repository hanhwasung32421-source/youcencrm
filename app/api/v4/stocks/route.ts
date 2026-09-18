import { NextResponse } from 'next/server'
import { aggregateStocks, getPeriodRange, parsePeriod } from '@/lib/v4/analytics'
import { loadVideos, requireV4User, v4ErrorResponse } from '@/lib/v4/server'

export async function GET(request: Request) {
  try {
    const { profile, supabaseAdmin, isAdmin } = await requireV4User(request)
    const url = new URL(request.url)
    const range = getPeriodRange(parsePeriod(url.searchParams.get('period')))
    const recent30 = getPeriodRange(30)
    const ownerId = isAdmin ? null : profile.id

    // 현재 기간 + 직전 기간을 한 번에 가져와 JS에서 나눈다 (전기 대비 추세 계산용).
    const [windowVideos, recentVideos] = await Promise.all([
      loadVideos(supabaseAdmin, { startIso: range.prevStartIso, endIso: range.endIso, ownerId }),
      loadVideos(supabaseAdmin, { startIso: recent30.startIso, endIso: recent30.endIso, ownerId })
    ])
    const current = windowVideos.filter((v) => v.created_at >= range.startIso)
    const previous = windowVideos.filter((v) => v.created_at < range.startIso)

    const items = aggregateStocks(current, previous)
    const top5Recent = aggregateStocks(recentVideos, [])
      .filter((s) => s.totalViews > 0)
      .sort((a, b) => b.avgViews - a.avgViews || b.totalViews - a.totalViews)
      .slice(0, 5)
      .map(({ stockName, videoCount, totalViews, avgViews }) => ({ stockName, videoCount, totalViews, avgViews }))

    return NextResponse.json({
      scope: isAdmin ? 'admin' : 'staff',
      period: range.days,
      range: { start: range.startYmd, end: range.endYmd },
      previousRange: { start: range.prevStartYmd, end: range.prevEndYmd },
      items,
      top5Recent,
      totals: {
        stockCount: items.length,
        videoCount: current.length
      }
    })
  } catch (e) {
    return v4ErrorResponse(e, '종목 트렌드 조회 실패')
  }
}
