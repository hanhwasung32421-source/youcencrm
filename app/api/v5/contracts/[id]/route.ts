import { NextResponse } from 'next/server'
import { z } from 'zod'
import { V5_TABLES } from '@/lib/v5/tables'
import { CONTRACT_STATUSES } from '@/lib/v5/types'
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
  readJson,
  ymdSchema
} from '@/lib/v5/api'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  partner_id: z.string().min(1).optional(),
  deal_id: z.preprocess((v) => (v === '' ? null : v), z.string().min(1).nullable().optional()),
  campaign_name: z.string().trim().min(1).max(200).optional(),
  amount: amountSchema.optional(),
  starts_on: ymdSchema.optional(),
  ends_on: ymdSchema.optional(),
  ad_disclosure: z.boolean().optional(),
  deliverables: optionalText,
  status: z.enum(CONTRACT_STATUSES).optional(),
  document_url: optionalText
})

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await getSession(request)
    if (!session.isAdmin) return forbidden()
    const { supabaseAdmin } = session
    const { id } = await params
    const body = patchSchema.parse(await readJson(request))
    if (body.starts_on && body.ends_on && body.ends_on < body.starts_on) return badRequest('종료일은 시작일 이후여야 합니다.')

    const { data, error } = await supabaseAdmin
      .from(V5_TABLES.contracts)
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle()

    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }
    if (!data) return notFound('계약을 찾을 수 없습니다.')
    return NextResponse.json({ item: data })
  } catch (e) {
    return handleRouteError(e, '계약 수정 실패')
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await getSession(request)
    if (!session.isAdmin) return forbidden()
    const { supabaseAdmin } = session
    const { id } = await params

    const { error } = await supabaseAdmin.from(V5_TABLES.contracts).delete().eq('id', id)
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw error
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleRouteError(e, '계약 삭제 실패')
  }
}
