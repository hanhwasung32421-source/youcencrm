import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { V3_TABLES } from '@/lib/v3/tables'
import { getCurrentMonth, isValidMonth } from '@/lib/v3/finance'
import { authenticateAdmin, computeMonthlySettlements, isMissingTableError, missingTableResponse, readJson } from '@/lib/v3/server'

const confirmSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '월 형식은 YYYY-MM 이어야 합니다.'),
  // 생략하면 해당 월 전체 직원 확정
  userIds: z.array(z.string().uuid()).optional(),
  // true면 이미 확정된 행도 다시 계산해서 덮어쓴다
  recompute: z.boolean().optional()
})

// GET /api/v3/incentive-settlements?month=YYYY-MM
// 실제 youtubeCRM_videos 기준 계산 + 규칙 + 확정 스냅샷을 합쳐 돌려준다.
export async function GET(request: Request) {
  const auth = await authenticateAdmin(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin } = auth

  try {
    const monthParam = new URL(request.url).searchParams.get('month')
    const month = isValidMonth(monthParam) ? monthParam : getCurrentMonth()
    const { rows, rulesSample, settlementsSample } = await computeMonthlySettlements(supabaseAdmin, month)

    const totals = rows.reduce(
      (acc, row) => {
        acc.videoCount += row.breakdown.videoCount
        acc.totalViews += row.breakdown.totalViews
        acc.computedAmount += row.breakdown.amount
        acc.confirmedAmount += row.confirmed?.computed_amount || 0
        if (row.confirmed) acc.confirmedCount += 1
        return acc
      },
      { videoCount: 0, totalViews: 0, computedAmount: 0, confirmedAmount: 0, confirmedCount: 0 }
    )

    return NextResponse.json({
      month,
      sample: rulesSample || settlementsSample,
      rulesSample,
      settlementsSample,
      rows,
      totals
    })
  } catch (e) {
    return errorResponse(e, '인센티브 정산 조회에 실패했습니다.')
  }
}

// POST: 월 확정 — 현재 계산 결과를 스냅샷으로 저장(upsert on user_id, month)
export async function POST(request: Request) {
  const auth = await authenticateAdmin(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin, profile } = auth

  const parsed = confirmSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '입력값을 확인해 주세요.' }, { status: 400 })
  }

  try {
    const { month, userIds, recompute } = parsed.data
    const { rows, settlementsSample } = await computeMonthlySettlements(supabaseAdmin, month)
    if (settlementsSample) return missingTableResponse()

    const targets = rows.filter((row) => (!userIds || userIds.includes(row.userId)) && (recompute || !row.confirmed))
    if (targets.length === 0) {
      return NextResponse.json({ ok: true, confirmed: 0, message: '확정할 대상이 없습니다.' })
    }

    const now = new Date().toISOString()
    const { error } = await supabaseAdmin.from(V3_TABLES.incentiveSettlements).upsert(
      targets.map((row) => ({
        user_id: row.userId,
        month,
        video_count: row.breakdown.videoCount,
        total_views: row.breakdown.totalViews,
        computed_amount: row.breakdown.amount,
        confirmed_at: now,
        confirmed_by: profile.id
      })),
      { onConflict: 'user_id,month' }
    )
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw new Error(error.message)
    }

    return NextResponse.json({ ok: true, confirmed: targets.length })
  } catch (e) {
    return errorResponse(e, '인센티브 정산 확정에 실패했습니다.')
  }
}

// DELETE /api/v3/incentive-settlements?month=YYYY-MM&userId=... — 확정 취소
export async function DELETE(request: Request) {
  const auth = await authenticateAdmin(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin } = auth

  const url = new URL(request.url)
  const month = url.searchParams.get('month')
  const userId = url.searchParams.get('userId')
  if (!isValidMonth(month) || !userId || !z.string().uuid().safeParse(userId).success) {
    return NextResponse.json({ error: 'month와 userId가 필요합니다.' }, { status: 400 })
  }

  try {
    const { error } = await supabaseAdmin.from(V3_TABLES.incentiveSettlements).delete().eq('month', month).eq('user_id', userId)
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw new Error(error.message)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e, '정산 확정 취소에 실패했습니다.')
  }
}
