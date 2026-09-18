import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/api/error-response'
import { computeIncentive, DEFAULT_INCENTIVE_RULE, getCurrentMonth, isValidMonth } from '@/lib/v3/finance'
import { authenticate, loadIncentiveRules, loadSettlements, loadVideosForMonth } from '@/lib/v3/server'

// GET /api/v3/my-settlement?month=YYYY-MM
// 로그인한 본인의 데이터만 돌려준다(관리자도 본인 기준).
export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin, profile } = auth

  try {
    const monthParam = new URL(request.url).searchParams.get('month')
    const month = isValidMonth(monthParam) ? monthParam : getCurrentMonth()

    const [videos, { rules, sample: rulesSample }, { settlements, sample: settlementsSample }] = await Promise.all([
      loadVideosForMonth(supabaseAdmin, month, profile.id),
      loadIncentiveRules(supabaseAdmin, [profile.id]),
      loadSettlements(supabaseAdmin, { userId: profile.id }, [{ id: profile.id, name: profile.name }])
    ])

    const stored = rules.get(profile.id)
    const rule = stored
      ? { base_pay: stored.base_pay, per_video: stored.per_video, per_1k_views: stored.per_1k_views, longform_weight: stored.longform_weight, shortform_weight: stored.shortform_weight }
      : { ...DEFAULT_INCENTIVE_RULE }
    const breakdown = computeIncentive(rule, videos)
    const thisMonthConfirmed = settlements.find((row) => row.month === month) || null
    const history = settlements.filter((row) => !!row.confirmed_at).sort((a, b) => b.month.localeCompare(a.month))

    return NextResponse.json({
      month,
      sample: rulesSample || settlementsSample,
      me: { id: profile.id, name: profile.name },
      rule,
      ruleIsDefault: !stored,
      breakdown,
      confirmed: thisMonthConfirmed,
      videos: videos.map((video) => ({
        id: video.id,
        title: video.title,
        stock_name: video.stock_name,
        content_type: video.content_type,
        view_count: Number(video.view_count || 0),
        created_at: video.created_at,
        youtube_url: video.youtube_url
      })),
      history
    })
  } catch (e) {
    return errorResponse(e, '내 정산 조회에 실패했습니다.')
  }
}
