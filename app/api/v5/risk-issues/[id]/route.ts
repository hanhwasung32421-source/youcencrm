import { NextResponse } from 'next/server'
import { z } from 'zod'
import { V5_TABLES } from '@/lib/v5/tables'
import { RISK_SEVERITIES, RISK_STATUSES } from '@/lib/v5/types'
import { forbidden, getSession, handleRouteError, isMissingTableError, missingTableResponse, notFound, optionalText, readJson } from '@/lib/v5/api'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  severity: z.enum(RISK_SEVERITIES).optional(),
  status: z.enum(RISK_STATUSES).optional(),
  action_note: optionalText,
  partner_id: z.preprocess((v) => (v === '' ? null : v), z.string().min(1).nullable().optional()),
  video_id: z.preprocess((v) => (v === '' ? null : v), z.string().min(1).nullable().optional())
})

// 관리자는 모든 이슈, 직원은 본인이 등록한 이슈만 수정.
export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await getSession(request)
    const { supabaseAdmin, profile, isAdmin } = session
    const { id } = await params
    const body = patchSchema.parse(await readJson(request))

    const { data: existing, error: readError } = await supabaseAdmin.from(V5_TABLES.riskIssues).select('id, created_by').eq('id', id).maybeSingle()
    if (readError) {
      if (isMissingTableError(readError)) return missingTableResponse()
      throw readError
    }
    if (!existing) return notFound('리스크 이슈를 찾을 수 없습니다.')
    if (!isAdmin && existing.created_by !== profile.id) return forbidden('본인이 등록한 이슈만 수정할 수 있습니다.')
    if (!isAdmin) delete body.partner_id

    const { data, error } = await supabaseAdmin
      .from(V5_TABLES.riskIssues)
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json({ item: data })
  } catch (e) {
    return handleRouteError(e, '리스크 이슈 수정 실패')
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await getSession(request)
    if (!session.isAdmin) return forbidden()
    const { supabaseAdmin } = session
    const { id } = await params

    const { error } = await supabaseAdmin.from(V5_TABLES.riskIssues).delete().eq('id', id)
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleRouteError(e, '리스크 이슈 삭제 실패')
  }
}
