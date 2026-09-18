import { NextResponse } from 'next/server'
import { z } from 'zod'
import { V5_TABLES } from '@/lib/v5/tables'
import { DEAL_STAGES } from '@/lib/v5/types'
import {
  amountSchema,
  badRequest,
  forbidden,
  getSession,
  handleRouteError,
  isMissingTableError,
  missingTableResponse,
  notFound,
  optionalText,
  optionalYmd,
  readJson
} from '@/lib/v5/api'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  partner_id: z.string().min(1).optional(),
  campaign_name: z.string().trim().min(1).max(200).optional(),
  stage: z.enum(DEAL_STAGES).optional(),
  expected_amount: amountSchema.optional(),
  owner_user_id: z.preprocess((v) => (v === '' ? null : v), z.string().min(1).nullable().optional()),
  planned_publish_on: optionalYmd,
  next_action: optionalText,
  next_action_on: optionalYmd,
  close_reason: optionalText
})

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await getSession(request)
    if (!session.isAdmin) return forbidden()
    const { supabaseAdmin } = session
    const { id } = await params
    const body = patchSchema.parse(await readJson(request))

    // 완료/실패로 닫을 때는 사유를 받는다. 다시 열면 사유를 비운다.
    const update: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() }
    if (body.stage === 'won' || body.stage === 'lost') {
      if (!body.close_reason) return badRequest(body.stage === 'won' ? '완료 사유(성과 요약)를 입력해 주세요.' : '실패 사유를 입력해 주세요.')
      update.next_action = null
      update.next_action_on = null
    } else if (body.stage) {
      update.close_reason = null
    }

    const { data, error } = await supabaseAdmin.from(V5_TABLES.deals).update(update).eq('id', id).select('*').maybeSingle()
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }
    if (!data) return notFound('딜을 찾을 수 없습니다.')
    return NextResponse.json({ item: data })
  } catch (e) {
    return handleRouteError(e, '딜 수정 실패')
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await getSession(request)
    if (!session.isAdmin) return forbidden()
    const { supabaseAdmin } = session
    const { id } = await params

    const { error } = await supabaseAdmin.from(V5_TABLES.deals).delete().eq('id', id)
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleRouteError(e, '딜 삭제 실패')
  }
}
