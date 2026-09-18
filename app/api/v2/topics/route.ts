import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { V2_TABLES } from '@/lib/v2/tables'
import {
  authedContext,
  forbidden,
  handleDbError,
  handleRouteError,
  isMissingTableError,
  loadStaff,
  loadRecentStocks,
  loadStaffMap,
  missingTableResponse,
  nowIso
} from '@/lib/v2/server'
import { sampleRecentStocks, sampleTopics } from '@/lib/v2/sample-data'
import { PRIORITIES, TOPIC_STATUSES, type TopicItem, type TopicsPayload } from '@/lib/v2/types'

const createSchema = z.object({
  stockName: z.string().trim().min(1, '종목명을 입력해 주세요.').max(80),
  issueSummary: z.string().trim().max(500).optional().nullable(),
  sourceUrl: z.string().trim().url('출처 URL 형식이 올바르지 않습니다.').optional().or(z.literal('')).nullable(),
  urgency: z.enum(PRIORITIES).default('normal')
})

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(TOPIC_STATUSES).optional(),
  urgency: z.enum(PRIORITIES).optional(),
  stockName: z.string().trim().min(1).max(80).optional(),
  issueSummary: z.string().trim().max(500).optional().nullable(),
  sourceUrl: z.string().trim().url().optional().or(z.literal('')).nullable()
})

const SELECT = 'id, stock_name, issue_summary, source_url, urgency, status, assigned_to, created_by, created_at'

const STATUS_ORDER: Record<string, number> = { waiting: 0, assigned: 1, produced: 2 }
const URGENCY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }

export async function GET(request: Request) {
  try {
    const { supabaseAdmin, isAdmin } = await authedContext(request)

    const [{ data: rows, error }, recentStocks, staff] = await Promise.all([
      supabaseAdmin.from(V2_TABLES.topicQueue).select(SELECT).order('created_at', { ascending: false }).limit(300),
      loadRecentStocks(supabaseAdmin),
      loadStaff(supabaseAdmin)
    ])

    if (error) {
      if (isMissingTableError(error)) {
        const payload: TopicsPayload = {
          items: sampleTopics(),
          recentStocks: recentStocks.length > 0 ? recentStocks : sampleRecentStocks(),
          staff: isAdmin ? staff : [],
          sample: true
        }
        return NextResponse.json(payload)
      }
      return errorResponse(error, '종목·이슈 큐 조회 실패')
    }

    const staffMap = await loadStaffMap(supabaseAdmin)
    const items: TopicItem[] = ((rows || []) as Omit<TopicItem, 'assigned_name' | 'created_by_name'>[])
      .map((row) => ({
        ...row,
        assigned_name: row.assigned_to ? staffMap.get(row.assigned_to) || null : null,
        created_by_name: row.created_by ? staffMap.get(row.created_by) || null : null
      }))
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] ||
          (a.created_at < b.created_at ? 1 : -1)
      )

    const payload: TopicsPayload = { items, recentStocks, staff: isAdmin ? staff : [] }
    return NextResponse.json(payload)
  } catch (e) {
    return handleRouteError(e, '종목·이슈 큐 조회 실패')
  }
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json())
    const { profile, supabaseAdmin } = await authedContext(request)

    const { data, error } = await supabaseAdmin
      .from(V2_TABLES.topicQueue)
      .insert({
        stock_name: body.stockName,
        issue_summary: body.issueSummary || null,
        source_url: body.sourceUrl || null,
        urgency: body.urgency,
        status: 'waiting',
        created_by: profile.id,
        created_at: nowIso(),
        updated_at: nowIso()
      })
      .select(SELECT)
      .single()
    if (error || !data) return handleDbError(error, '이슈 등록 실패')
    return NextResponse.json({ ok: true, item: data })
  } catch (e) {
    return handleRouteError(e, '이슈 등록 실패')
  }
}

export async function PATCH(request: Request) {
  try {
    const body = patchSchema.parse(await request.json())
    const { profile, supabaseAdmin, isAdmin } = await authedContext(request)

    const { data: existing, error: loadError } = await supabaseAdmin
      .from(V2_TABLES.topicQueue)
      .select('id, created_by')
      .eq('id', body.id)
      .maybeSingle()
    if (loadError) return handleDbError(loadError, '이슈 조회 실패')
    if (!existing) return NextResponse.json({ error: '이슈를 찾을 수 없습니다.' }, { status: 404 })
    if (!isAdmin && existing.created_by !== profile.id) return forbidden('본인이 등록한 이슈만 수정할 수 있습니다.')

    const patch: Record<string, unknown> = { updated_at: nowIso() }
    if (body.status !== undefined) patch.status = body.status
    if (body.urgency !== undefined) patch.urgency = body.urgency
    if (body.stockName !== undefined) patch.stock_name = body.stockName
    if (body.issueSummary !== undefined) patch.issue_summary = body.issueSummary || null
    if (body.sourceUrl !== undefined) patch.source_url = body.sourceUrl || null

    const { data, error } = await supabaseAdmin.from(V2_TABLES.topicQueue).update(patch).eq('id', body.id).select(SELECT).single()
    if (error || !data) return handleDbError(error, '이슈 수정 실패')
    return NextResponse.json({ ok: true, item: data })
  } catch (e) {
    return handleRouteError(e, '이슈 수정 실패')
  }
}

export async function DELETE(request: Request) {
  try {
    const { profile, supabaseAdmin, isAdmin } = await authedContext(request)
    const id = new URL(request.url).searchParams.get('id') || ''
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: '삭제할 이슈 ID가 올바르지 않습니다.' }, { status: 400 })
    }
    const { data: existing, error: loadError } = await supabaseAdmin.from(V2_TABLES.topicQueue).select('id, created_by').eq('id', id).maybeSingle()
    if (loadError) {
      if (isMissingTableError(loadError)) return missingTableResponse()
      return errorResponse(loadError, '이슈 삭제 실패')
    }
    if (!existing) return NextResponse.json({ ok: true })
    if (!isAdmin && existing.created_by !== profile.id) return forbidden('본인이 등록한 이슈만 삭제할 수 있습니다.')

    const { error } = await supabaseAdmin.from(V2_TABLES.topicQueue).delete().eq('id', id)
    if (error) return handleDbError(error, '이슈 삭제 실패')
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleRouteError(e, '이슈 삭제 실패')
  }
}
