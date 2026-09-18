import { NextResponse } from 'next/server'
import { z } from 'zod'
import { V2_TABLES } from '@/lib/v2/tables'
import { authedContext, decorateItems, forbidden, handleDbError, handleRouteError, materializeChecklist, nowIso } from '@/lib/v2/server'
import { CONTENT_TYPES, PRIORITIES } from '@/lib/v2/types'

const bodySchema = z.object({
  topicId: z.string().uuid(),
  assigneeUserId: z.string().uuid('담당자를 선택해 주세요.'),
  contentType: z.enum(CONTENT_TYPES).default('longform'),
  priority: z.enum(PRIORITIES).optional(),
  dueAt: z.string().datetime({ offset: true }).optional().nullable()
})

const ITEM_SELECT = 'id, stock_name, issue_summary, assignee_user_id, content_type, stage, priority, due_at, note, video_id, topic_id, created_by, created_at, updated_at'

// 관리자: 큐 아이템을 담당자에게 배정 → 기획 단계 제작 아이템 생성 + 큐 상태 '배정됨'
export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const { profile, supabaseAdmin, isAdmin } = await authedContext(request)
    if (!isAdmin) return forbidden('배정은 관리자만 할 수 있습니다.')

    const { data: topic, error: topicError } = await supabaseAdmin
      .from(V2_TABLES.topicQueue)
      .select('id, stock_name, issue_summary, urgency, status')
      .eq('id', body.topicId)
      .maybeSingle()
    if (topicError) return handleDbError(topicError, '이슈 조회 실패')
    if (!topic) return NextResponse.json({ error: '이슈를 찾을 수 없습니다.' }, { status: 404 })

    const { data: item, error: itemError } = await supabaseAdmin
      .from(V2_TABLES.productionItems)
      .insert({
        stock_name: topic.stock_name,
        issue_summary: topic.issue_summary,
        assignee_user_id: body.assigneeUserId,
        content_type: body.contentType,
        stage: 'planning',
        priority: body.priority || topic.urgency || 'normal',
        due_at: body.dueAt || null,
        topic_id: topic.id,
        created_by: profile.id,
        created_at: nowIso(),
        updated_at: nowIso()
      })
      .select(ITEM_SELECT)
      .single()
    if (itemError || !item) return handleDbError(itemError, '제작 아이템 생성 실패')

    try {
      await materializeChecklist(supabaseAdmin, item)
    } catch {}

    const { error: updateError } = await supabaseAdmin
      .from(V2_TABLES.topicQueue)
      .update({ status: 'assigned', assigned_to: body.assigneeUserId, updated_at: nowIso() })
      .eq('id', topic.id)
    if (updateError) return handleDbError(updateError, '이슈 상태 변경 실패')

    const [decorated] = await decorateItems(supabaseAdmin, [item])
    return NextResponse.json({ ok: true, item: decorated })
  } catch (e) {
    return handleRouteError(e, '이슈 배정 실패')
  }
}
