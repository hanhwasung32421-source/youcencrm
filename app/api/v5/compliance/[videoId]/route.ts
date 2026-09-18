import { NextResponse } from 'next/server'
import { z } from 'zod'
import { V5_TABLES } from '@/lib/v5/tables'
import { COMPLIANCE_STATUSES } from '@/lib/v5/types'
import { forbidden, getSession, handleRouteError, isMissingTableError, missingTableResponse, notFound, optionalText, readJson } from '@/lib/v5/api'

type Params = { params: Promise<{ videoId: string }> }

const schema = z.object({
  paid_ad_disclosed: z.boolean().optional(),
  stock_disclaimer: z.boolean().optional(),
  no_solicitation_notice: z.boolean().optional(),
  source_cited: z.boolean().optional(),
  thumbnail_reviewed: z.boolean().optional(),
  status: z.enum(COMPLIANCE_STATUSES).optional(),
  note: optionalText
})

// 영상 1건의 체크리스트를 upsert. 관리자는 모든 영상, 직원은 본인 영상만.
export async function PUT(request: Request, { params }: Params) {
  try {
    const session = await getSession(request)
    const { supabaseAdmin, profile, isAdmin } = session
    const { videoId } = await params
    const body = schema.parse(await readJson(request))

    const { data: video, error: videoError } = await supabaseAdmin
      .from(V5_TABLES.videos)
      .select('id, primary_owner_user_id')
      .eq('id', videoId)
      .maybeSingle()
    if (videoError) throw videoError
    if (!video) return notFound('영상을 찾을 수 없습니다.')
    if (!isAdmin && video.primary_owner_user_id !== profile.id) return forbidden('본인 영상만 체크할 수 있습니다.')

    const { data: existing, error: readError } = await supabaseAdmin
      .from(V5_TABLES.complianceChecks)
      .select('*')
      .eq('video_id', videoId)
      .maybeSingle()
    if (readError) {
      if (isMissingTableError(readError)) return missingTableResponse()
      throw readError
    }

    const merged = {
      video_id: videoId,
      paid_ad_disclosed: body.paid_ad_disclosed ?? existing?.paid_ad_disclosed ?? false,
      stock_disclaimer: body.stock_disclaimer ?? existing?.stock_disclaimer ?? false,
      no_solicitation_notice: body.no_solicitation_notice ?? existing?.no_solicitation_notice ?? false,
      source_cited: body.source_cited ?? existing?.source_cited ?? false,
      thumbnail_reviewed: body.thumbnail_reviewed ?? existing?.thumbnail_reviewed ?? false,
      status: body.status ?? existing?.status ?? 'unchecked',
      note: body.note === undefined ? existing?.note ?? null : body.note,
      reviewer_user_id: profile.id,
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabaseAdmin
      .from(V5_TABLES.complianceChecks)
      .upsert(merged, { onConflict: 'video_id' })
      .select('*')
      .single()
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }
    return NextResponse.json({ item: { ...data, reviewer_name: profile.name } })
  } catch (e) {
    return handleRouteError(e, '컴플라이언스 체크 저장 실패')
  }
}
