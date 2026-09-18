import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { V2_TABLES } from '@/lib/v2/tables'
import { authedContext, forbidden, handleDbError, handleRouteError, isMissingTableError, nowIso } from '@/lib/v2/server'
import { sampleTemplatesPayload } from '@/lib/v2/sample-data'
import { CONTENT_TYPES, type ChecklistTemplate, type TemplatesPayload } from '@/lib/v2/types'

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, '템플릿 이름을 입력해 주세요.').max(80),
  contentType: z.enum(CONTENT_TYPES).nullable().optional(),
  items: z.array(z.string().trim().min(1).max(200)).min(1, '항목을 한 개 이상 입력해 주세요.').max(40),
  isDefault: z.boolean().default(false)
})

const SELECT = 'id, name, content_type, items, is_default, created_at'

export async function GET(request: Request) {
  try {
    const { supabaseAdmin } = await authedContext(request)
    const { data, error } = await supabaseAdmin.from(V2_TABLES.checklistTemplates).select(SELECT).order('created_at', { ascending: true })
    if (error) {
      if (isMissingTableError(error)) return NextResponse.json(sampleTemplatesPayload())
      return errorResponse(error, '체크리스트 템플릿 조회 실패')
    }
    const items = ((data || []) as ChecklistTemplate[]).map((row) => ({
      ...row,
      items: Array.isArray(row.items) ? row.items.map((item) => String(item)) : []
    }))
    const payload: TemplatesPayload = { items }
    return NextResponse.json(payload)
  } catch (e) {
    return handleRouteError(e, '체크리스트 템플릿 조회 실패')
  }
}

// 관리자: 생성/수정. 같은 형식의 기본 템플릿은 하나만 유지한다.
export async function POST(request: Request) {
  try {
    const body = upsertSchema.parse(await request.json())
    const { supabaseAdmin, isAdmin } = await authedContext(request)
    if (!isAdmin) return forbidden('템플릿 관리는 관리자만 할 수 있습니다.')

    const payload = {
      name: body.name,
      content_type: body.contentType ?? null,
      items: body.items,
      is_default: body.isDefault,
      updated_at: nowIso()
    }

    const query = body.id
      ? supabaseAdmin.from(V2_TABLES.checklistTemplates).update(payload).eq('id', body.id)
      : supabaseAdmin.from(V2_TABLES.checklistTemplates).insert({ ...payload, created_at: nowIso() })
    const { data, error } = await query.select(SELECT).single()
    if (error || !data) return handleDbError(error, '체크리스트 템플릿 저장 실패')

    if (body.isDefault) {
      let unset = supabaseAdmin.from(V2_TABLES.checklistTemplates).update({ is_default: false, updated_at: nowIso() }).neq('id', data.id)
      unset = payload.content_type === null ? unset.is('content_type', null) : unset.eq('content_type', payload.content_type)
      await unset
    }

    return NextResponse.json({ ok: true, item: data })
  } catch (e) {
    return handleRouteError(e, '체크리스트 템플릿 저장 실패')
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabaseAdmin, isAdmin } = await authedContext(request)
    if (!isAdmin) return forbidden('템플릿 관리는 관리자만 할 수 있습니다.')
    const id = new URL(request.url).searchParams.get('id') || ''
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: '삭제할 템플릿 ID가 올바르지 않습니다.' }, { status: 400 })
    }
    const { error } = await supabaseAdmin.from(V2_TABLES.checklistTemplates).delete().eq('id', id)
    if (error) return handleDbError(error, '체크리스트 템플릿 삭제 실패')
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleRouteError(e, '체크리스트 템플릿 삭제 실패')
  }
}
