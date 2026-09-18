import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { authenticate, isMissingTableError, missingTableResponse, readJson } from '@/lib/v3/server'
import { V3_TABLES } from '@/lib/v3/tables'

const createSchema = z.object({
  name: z.string().min(1).max(200),
  stockName: z.string().max(100).optional().nullable(),
  videoIds: z.array(z.string().uuid()).default([])
})

// 시리즈/캠페인 목록(간단, 시리즈 선택용). 성과 지표가 포함된 목록은 GET /api/v3/format-series 사용.
export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin } = auth

  try {
    const { data, error } = await supabaseAdmin
      .from(V3_TABLES.videoSeries)
      .select('id, name, stock_name')
      .order('created_at', { ascending: false })

    if (error) {
      if (isMissingTableError(error)) return NextResponse.json({ items: [], sample: true })
      throw new Error(error.message)
    }

    return NextResponse.json({
      items: (data || []).map((row: any) => ({ id: row.id, name: row.name, stockName: row.stock_name })),
      sample: false
    })
  } catch (e) {
    return errorResponse(e, '시리즈 목록 조회에 실패했습니다.')
  }
}

// 새 시리즈 생성 + 초기 영상 묶기
export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin, profile } = auth

  try {
    const body = createSchema.parse((await readJson(request)) || {})

    const { data: series, error: seriesError } = await supabaseAdmin
      .from(V3_TABLES.videoSeries)
      .insert({ name: body.name, stock_name: body.stockName || null, created_by: profile.id })
      .select('id, name, stock_name, created_at')
      .single()

    if (seriesError) {
      if (isMissingTableError(seriesError)) return missingTableResponse()
      throw new Error(seriesError.message)
    }

    if (body.videoIds.length > 0) {
      const rows = body.videoIds.map((videoId) => ({ series_id: series.id, video_id: videoId }))
      const { error: memberError } = await supabaseAdmin.from(V3_TABLES.videoSeriesMembers).upsert(rows, { onConflict: 'video_id' })
      if (memberError) throw new Error(memberError.message)
    }

    return NextResponse.json({ ok: true, series: { id: series.id, name: series.name, stockName: series.stock_name } })
  } catch (e: any) {
    const firstIssue = e?.issues?.[0]
    if (firstIssue?.message) return NextResponse.json({ error: firstIssue.message }, { status: 400 })
    return errorResponse(e, '시리즈 생성에 실패했습니다.')
  }
}
