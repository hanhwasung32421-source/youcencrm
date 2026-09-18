import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { V2_TABLES } from '@/lib/v2/tables'
import {
  authedContext,
  decorateItems,
  forbidden,
  handleDbError,
  handleRouteError,
  isMissingTableError,
  loadStaff,
  materializeChecklist,
  missingTableResponse,
  nowIso
} from '@/lib/v2/server'
import { sampleItemsFor } from '@/lib/v2/sample-data'
import { CONTENT_TYPES, PRIORITIES, STAGES, type ItemsPayload } from '@/lib/v2/types'

const createSchema = z.object({
  stockName: z.string().trim().min(1, '종목명을 입력해 주세요.').max(80),
  issueSummary: z.string().trim().max(500).optional().nullable(),
  assigneeUserId: z.string().uuid().optional().nullable(),
  contentType: z.enum(CONTENT_TYPES),
  stage: z.enum(STAGES).optional(),
  priority: z.enum(PRIORITIES).default('normal'),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
  topicId: z.string().uuid().optional().nullable()
})

const patchSchema = z.object({
  id: z.string().uuid(),
  stage: z.enum(STAGES).optional(),
  stockName: z.string().trim().min(1).max(80).optional(),
  issueSummary: z.string().trim().max(500).optional().nullable(),
  assigneeUserId: z.string().uuid().optional().nullable(),
  contentType: z.enum(CONTENT_TYPES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
  videoId: z.string().uuid().optional().nullable()
})

const SELECT = 'id, stock_name, issue_summary, assignee_user_id, content_type, stage, priority, due_at, note, video_id, topic_id, created_by, created_at, updated_at'

// GET ?from=ISO&to=ISO&assignee=uuid&stage=... — 캘린더/목록용. 직원은 자기 것만.
export async function GET(request: Request) {
  try {
    const { profile, supabaseAdmin, isAdmin } = await authedContext(request)
    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const assigneeParam = url.searchParams.get('assignee')
    const stage = url.searchParams.get('stage')
    const assignee = isAdmin ? assigneeParam : profile.id

    let query = supabaseAdmin.from(V2_TABLES.productionItems).select(SELECT).order('due_at', { ascending: true, nullsFirst: false })
    if (from) query = query.gte('due_at', from)
    if (to) query = query.lt('due_at', to)
    if (assignee) query = query.eq('assignee_user_id', assignee)
    if (stage && (STAGES as readonly string[]).includes(stage)) query = query.eq('stage', stage)
    if (!from && !to) query = query.limit(300)

    const { data: rows, error } = await query
    if (error) {
      if (isMissingTableError(error)) return NextResponse.json(sampleItemsFor(profile, isAdmin, { from, to, assignee: assigneeParam }))
      return errorResponse(error, '제작 아이템 조회 실패')
    }

    const allStaff = await loadStaff(supabaseAdmin)
    let staff = isAdmin ? allStaff : allStaff.filter((s) => s.id === profile.id)
    if (!isAdmin && staff.length === 0) staff = [{ id: profile.id, name: profile.name, roleType: profile.role_type }]
    const items = await decorateItems(supabaseAdmin, rows || [])
    const payload: ItemsPayload = { items, staff }
    return NextResponse.json(payload)
  } catch (e) {
    return handleRouteError(e, '제작 아이템 조회 실패')
  }
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json())
    const { profile, supabaseAdmin, isAdmin } = await authedContext(request)

    // 직원은 항상 본인 담당으로만 만든다.
    const assigneeUserId = isAdmin ? body.assigneeUserId || profile.id : profile.id

    const { data, error } = await supabaseAdmin
      .from(V2_TABLES.productionItems)
      .insert({
        stock_name: body.stockName,
        issue_summary: body.issueSummary || null,
        assignee_user_id: assigneeUserId,
        content_type: body.contentType,
        stage: body.stage || 'planning',
        priority: body.priority,
        due_at: body.dueAt || null,
        note: body.note || null,
        topic_id: body.topicId || null,
        created_by: profile.id,
        created_at: nowIso(),
        updated_at: nowIso()
      })
      .select(SELECT)
      .single()

    if (error || !data) return handleDbError(error, '제작 아이템 생성 실패')

    // 기본 체크리스트는 만들 수 있으면 만들고, 실패해도 생성 자체는 성공으로 본다.
    try {
      await materializeChecklist(supabaseAdmin, data)
    } catch {}

    const [item] = await decorateItems(supabaseAdmin, [data])
    return NextResponse.json({ ok: true, item })
  } catch (e) {
    return handleRouteError(e, '제작 아이템 생성 실패')
  }
}

export async function PATCH(request: Request) {
  try {
    const body = patchSchema.parse(await request.json())
    const { profile, supabaseAdmin, isAdmin } = await authedContext(request)

    const { data: existing, error: loadError } = await supabaseAdmin
      .from(V2_TABLES.productionItems)
      .select(SELECT)
      .eq('id', body.id)
      .maybeSingle()
    if (loadError) return handleDbError(loadError, '제작 아이템 조회 실패')
    if (!existing) return NextResponse.json({ error: '제작 아이템을 찾을 수 없습니다.' }, { status: 404 })
    if (!isAdmin && existing.assignee_user_id !== profile.id && existing.created_by !== profile.id) {
      return forbidden('본인 담당 아이템만 수정할 수 있습니다.')
    }

    const patch: Record<string, unknown> = { updated_at: nowIso() }
    if (body.stage !== undefined) patch.stage = body.stage
    if (body.stockName !== undefined) patch.stock_name = body.stockName
    if (body.issueSummary !== undefined) patch.issue_summary = body.issueSummary || null
    if (body.assigneeUserId !== undefined && isAdmin) patch.assignee_user_id = body.assigneeUserId
    if (body.contentType !== undefined) patch.content_type = body.contentType
    if (body.priority !== undefined) patch.priority = body.priority
    if (body.dueAt !== undefined) patch.due_at = body.dueAt
    if (body.note !== undefined) patch.note = body.note || null
    if (body.videoId !== undefined) patch.video_id = body.videoId

    const { data, error } = await supabaseAdmin.from(V2_TABLES.productionItems).update(patch).eq('id', body.id).select(SELECT).single()
    if (error || !data) return handleDbError(error, '제작 아이템 수정 실패')

    // 큐에서 배정된 아이템이 완료되면 큐 상태도 '제작됨'으로
    if (body.stage === 'done' && data.topic_id) {
      await supabaseAdmin
        .from(V2_TABLES.topicQueue)
        .update({ status: 'produced', updated_at: nowIso() })
        .eq('id', data.topic_id)
    }

    const [item] = await decorateItems(supabaseAdmin, [data])
    return NextResponse.json({ ok: true, item })
  } catch (e) {
    return handleRouteError(e, '제작 아이템 수정 실패')
  }
}

export async function DELETE(request: Request) {
  try {
    const { profile, supabaseAdmin, isAdmin } = await authedContext(request)
    const id = new URL(request.url).searchParams.get('id') || ''
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: '삭제할 아이템 ID가 올바르지 않습니다.' }, { status: 400 })
    }

    const { data: existing, error: loadError } = await supabaseAdmin
      .from(V2_TABLES.productionItems)
      .select('id, assignee_user_id, created_by')
      .eq('id', id)
      .maybeSingle()
    if (loadError) {
      if (isMissingTableError(loadError)) return missingTableResponse()
      return errorResponse(loadError, '제작 아이템 삭제 실패')
    }
    if (!existing) return NextResponse.json({ ok: true })
    if (!isAdmin && existing.assignee_user_id !== profile.id && existing.created_by !== profile.id) {
      return forbidden('본인 담당 아이템만 삭제할 수 있습니다.')
    }

    const { error } = await supabaseAdmin.from(V2_TABLES.productionItems).delete().eq('id', id)
    if (error) return handleDbError(error, '제작 아이템 삭제 실패')
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleRouteError(e, '제작 아이템 삭제 실패')
  }
}
