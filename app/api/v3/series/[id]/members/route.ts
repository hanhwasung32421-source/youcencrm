import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { authenticate, isMissingTableError, missingTableResponse, readJson } from '@/lib/v3/server'
import { V3_TABLES } from '@/lib/v3/tables'

const bodySchema = z.object({ videoId: z.string().uuid() })

async function loadSeriesOwner(supabaseAdmin: any, seriesId: string) {
  const { data, error } = await supabaseAdmin.from(V3_TABLES.videoSeries).select('id, created_by').eq('id', seriesId).maybeSingle()
  if (error) throw error
  return data as { id: string; created_by: string | null } | null
}

// 기존 시리즈에 영상 추가
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin, profile, isAdmin } = auth
  const { id } = await context.params

  try {
    const body = bodySchema.parse((await readJson(request)) || {})

    let series
    try {
      series = await loadSeriesOwner(supabaseAdmin, id)
    } catch (e: any) {
      if (isMissingTableError(e)) return missingTableResponse()
      throw e
    }
    if (!series) return NextResponse.json({ error: '시리즈를 찾을 수 없습니다.' }, { status: 404 })
    if (!isAdmin && series.created_by !== profile.id) {
      return NextResponse.json({ error: '본인이 만든 시리즈만 편집할 수 있습니다.' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from(V3_TABLES.videoSeriesMembers)
      .upsert({ series_id: id, video_id: body.videoId }, { onConflict: 'video_id' })
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw new Error(error.message)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const firstIssue = e?.issues?.[0]
    if (firstIssue?.message) return NextResponse.json({ error: firstIssue.message }, { status: 400 })
    return errorResponse(e, '시리즈에 영상을 추가하지 못했습니다.')
  }
}

// 시리즈에서 영상 제외
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin, profile, isAdmin } = auth
  const { id } = await context.params

  try {
    const body = bodySchema.parse((await readJson(request)) || {})

    let series
    try {
      series = await loadSeriesOwner(supabaseAdmin, id)
    } catch (e: any) {
      if (isMissingTableError(e)) return missingTableResponse()
      throw e
    }
    if (!series) return NextResponse.json({ error: '시리즈를 찾을 수 없습니다.' }, { status: 404 })
    if (!isAdmin && series.created_by !== profile.id) {
      return NextResponse.json({ error: '본인이 만든 시리즈만 편집할 수 있습니다.' }, { status: 403 })
    }

    const { error } = await supabaseAdmin.from(V3_TABLES.videoSeriesMembers).delete().eq('series_id', id).eq('video_id', body.videoId)
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw new Error(error.message)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const firstIssue = e?.issues?.[0]
    if (firstIssue?.message) return NextResponse.json({ error: firstIssue.message }, { status: 400 })
    return errorResponse(e, '시리즈에서 영상을 제외하지 못했습니다.')
  }
}
