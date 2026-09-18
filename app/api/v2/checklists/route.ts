import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { V2_TABLES } from '@/lib/v2/tables'
import { authedContext, forbidden, handleDbError, handleRouteError, isMissingTableError, materializeChecklist, nowIso } from '@/lib/v2/server'
import { sampleChecklistFor, sampleProductionItems } from '@/lib/v2/sample-data'
import type { ChecklistPayload } from '@/lib/v2/types'

const toggleSchema = z.object({
  productionItemId: z.string().uuid(),
  itemIndex: z.number().int().min(0),
  checked: z.boolean()
})

// GET ?itemId= — 아이템 체크리스트. 없으면 기본 템플릿으로 만들어서 돌려준다.
export async function GET(request: Request) {
  try {
    const { profile, supabaseAdmin, isAdmin } = await authedContext(request)
    const itemId = new URL(request.url).searchParams.get('itemId') || ''
    if (!z.string().uuid().safeParse(itemId).success) {
      return NextResponse.json({ error: '아이템 ID가 올바르지 않습니다.' }, { status: 400 })
    }

    const { data: item, error: itemError } = await supabaseAdmin
      .from(V2_TABLES.productionItems)
      .select('id, content_type, stage, assignee_user_id, created_by')
      .eq('id', itemId)
      .maybeSingle()
    if (itemError) {
      if (isMissingTableError(itemError)) {
        const sampleItem = sampleProductionItems().find((s) => s.id === itemId) || null
        const payload: ChecklistPayload = { ...sampleChecklistFor(sampleItem), sample: true }
        return NextResponse.json(payload)
      }
      return errorResponse(itemError, '체크리스트 조회 실패')
    }
    if (!item) return NextResponse.json({ error: '제작 아이템을 찾을 수 없습니다.' }, { status: 404 })
    if (!isAdmin && item.assignee_user_id !== profile.id && item.created_by !== profile.id) {
      return forbidden('본인 담당 아이템만 볼 수 있습니다.')
    }

    try {
      const { rows, templateName } = await materializeChecklist(supabaseAdmin, item)
      const payload: ChecklistPayload = { items: rows, templateName }
      return NextResponse.json(payload)
    } catch (e) {
      return handleDbError(e, '체크리스트 조회 실패')
    }
  } catch (e) {
    return handleRouteError(e, '체크리스트 조회 실패')
  }
}

export async function POST(request: Request) {
  try {
    const body = toggleSchema.parse(await request.json())
    const { profile, supabaseAdmin, isAdmin } = await authedContext(request)

    const { data: item, error: itemError } = await supabaseAdmin
      .from(V2_TABLES.productionItems)
      .select('id, assignee_user_id, created_by')
      .eq('id', body.productionItemId)
      .maybeSingle()
    if (itemError) return handleDbError(itemError, '체크리스트 저장 실패')
    if (!item) return NextResponse.json({ error: '제작 아이템을 찾을 수 없습니다.' }, { status: 404 })
    if (!isAdmin && item.assignee_user_id !== profile.id && item.created_by !== profile.id) {
      return forbidden('본인 담당 아이템만 체크할 수 있습니다.')
    }

    const { error } = await supabaseAdmin
      .from(V2_TABLES.productionChecklists)
      .update({ checked: body.checked, updated_at: nowIso() })
      .eq('production_item_id', body.productionItemId)
      .eq('item_index', body.itemIndex)
    if (error) return handleDbError(error, '체크리스트 저장 실패')
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleRouteError(e, '체크리스트 저장 실패')
  }
}
