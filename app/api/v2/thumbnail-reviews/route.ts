import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { TABLES } from '@/lib/supabase/tables'
import { V2_TABLES } from '@/lib/v2/tables'
import { authedContext, handleDbError, handleRouteError } from '@/lib/v2/server'
import type { ThumbnailReview } from '@/lib/v2/types'

// 썸네일 클릭률 자가평가(1~5점) 등록 — 제목·썸네일 최적화 보드에서 사용
const createSchema = z.object({
  videoId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  note: z.string().trim().max(300).optional().nullable()
})

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json())
    const { profile, supabaseAdmin, isAdmin } = await authedContext(request)

    const { data: video, error: videoError } = await supabaseAdmin
      .from(TABLES.videos)
      .select('id, primary_owner_user_id')
      .eq('id', body.videoId)
      .maybeSingle()
    if (videoError) return errorResponse(videoError, '영상 조회 실패')
    if (!video) return NextResponse.json({ error: '영상을 찾을 수 없습니다.' }, { status: 404 })
    if (!isAdmin && video.primary_owner_user_id !== profile.id) {
      return NextResponse.json({ error: '본인이 등록한 영상만 평가할 수 있습니다.' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from(V2_TABLES.thumbnailReviews)
      .insert({ video_id: body.videoId, rating: body.rating, note: body.note || null, reviewed_by: profile.id })
      .select('id, video_id, rating, note, reviewed_by, created_at')
      .single()
    if (error || !data) return handleDbError(error, '썸네일 평가 저장 실패')

    return NextResponse.json({ ok: true, item: data as ThumbnailReview })
  } catch (e) {
    return handleRouteError(e, '썸네일 평가 저장 실패')
  }
}
