import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { TABLES } from '@/lib/supabase/tables'
import { V2_TABLES } from '@/lib/v2/tables'
import { authedContext, handleDbError, handleRouteError, isMissingTableError, nowIso } from '@/lib/v2/server'
import { sampleSeoChecklistsPayload } from '@/lib/v2/sample-data'
import { SEO_CHECKLIST_FIELDS, type SeoChecklist, type SeoChecklistsPayload } from '@/lib/v2/types'

// 등록 직후 & 최적화 보드에서 영상별 SEO 체크리스트를 읽고 토글한다.
const patchSchema = z.object({
  videoId: z.string().uuid(),
  patch: z
    .object({
      title_has_stock: z.boolean().optional(),
      thumbnail_text_checked: z.boolean().optional(),
      description_timestamps: z.boolean().optional(),
      tags_5plus: z.boolean().optional()
    })
    .default({})
})

export async function GET(request: Request) {
  try {
    const { supabaseAdmin } = await authedContext(request)
    const url = new URL(request.url)
    const videoIds = (url.searchParams.get('videoIds') || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)

    if (videoIds.length === 0) {
      const payload: SeoChecklistsPayload = { items: [] }
      return NextResponse.json(payload)
    }

    const { data, error } = await supabaseAdmin.from(V2_TABLES.seoChecklists).select('*').in('video_id', videoIds)
    if (error) {
      if (isMissingTableError(error)) return NextResponse.json(sampleSeoChecklistsPayload(videoIds))
      return errorResponse(error, 'SEO 체크리스트 조회 실패')
    }

    const payload: SeoChecklistsPayload = { items: (data || []) as SeoChecklist[] }
    return NextResponse.json(payload)
  } catch (e) {
    return handleRouteError(e, 'SEO 체크리스트 조회 실패')
  }
}

export async function PATCH(request: Request) {
  try {
    const body = patchSchema.parse(await request.json())
    const { profile, supabaseAdmin, isAdmin } = await authedContext(request)

    const { data: video, error: videoError } = await supabaseAdmin
      .from(TABLES.videos)
      .select('id, primary_owner_user_id')
      .eq('id', body.videoId)
      .maybeSingle()
    if (videoError) return errorResponse(videoError, '영상 조회 실패')
    if (!video) return NextResponse.json({ error: '영상을 찾을 수 없습니다.' }, { status: 404 })
    if (!isAdmin && video.primary_owner_user_id !== profile.id) {
      return NextResponse.json({ error: '본인이 등록한 영상만 체크리스트를 수정할 수 있습니다.' }, { status: 403 })
    }

    const patchColumns: Record<string, boolean> = {}
    for (const field of SEO_CHECKLIST_FIELDS) {
      if (body.patch[field] !== undefined) patchColumns[field] = body.patch[field] as boolean
    }

    const { data, error } = await supabaseAdmin
      .from(V2_TABLES.seoChecklists)
      .upsert({ video_id: body.videoId, ...patchColumns, updated_at: nowIso() }, { onConflict: 'video_id' })
      .select('*')
      .single()
    if (error || !data) return handleDbError(error, 'SEO 체크리스트 저장 실패')

    return NextResponse.json({ ok: true, item: data as SeoChecklist })
  } catch (e) {
    return handleRouteError(e, 'SEO 체크리스트 저장 실패')
  }
}
