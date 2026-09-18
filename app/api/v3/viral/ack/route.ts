import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { authenticate, isMissingTableError, missingTableResponse, readJson } from '@/lib/v3/server'
import { V3_TABLES } from '@/lib/v3/tables'

const bodySchema = z.object({ videoId: z.string().uuid(), actionNote: z.string().max(500).optional().nullable() })

// 바이럴 후보 영상을 "봤음/조치함"으로 표시
export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin, profile } = auth

  try {
    const body = bodySchema.parse((await readJson(request)) || {})

    const { error } = await supabaseAdmin.from(V3_TABLES.viralSignalAcks).insert({
      video_id: body.videoId,
      acknowledged_by: profile.id,
      action_note: body.actionNote || null
    })

    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw new Error(error.message)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const firstIssue = e?.issues?.[0]
    if (firstIssue?.message) return NextResponse.json({ error: firstIssue.message }, { status: 400 })
    return errorResponse(e, '확인 처리에 실패했습니다.')
  }
}
