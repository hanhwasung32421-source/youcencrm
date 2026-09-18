import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { V2_TABLES } from '@/lib/v2/tables'
import { authedContext, forbidden, handleDbError, handleRouteError, isMissingTableError, loadRecentStocks, loadStaffMap, missingTableResponse, nowIso } from '@/lib/v2/server'
import { sampleKeywordsPayload } from '@/lib/v2/sample-data'
import { KEYWORD_STATUSES, PRIORITIES, type KeywordRadarItem, type KeywordsPayload } from '@/lib/v2/types'

// 키워드·트렌드 레이더 — "지금 다뤄야 할 검색 키워드/이슈" 팀 공유 보드
const createSchema = z.object({
  stockName: z.string().trim().min(1, '종목명을 입력해 주세요.').max(80),
  keyword: z.string().trim().min(1, '키워드를 입력해 주세요.').max(120),
  sourceUrl: z.string().trim().url('출처 URL 형식이 올바르지 않습니다.').optional().or(z.literal('')).nullable(),
  priority: z.enum(PRIORITIES).default('normal')
})

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(KEYWORD_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  stockName: z.string().trim().min(1).max(80).optional(),
  keyword: z.string().trim().min(1).max(120).optional(),
  sourceUrl: z.string().trim().url().optional().or(z.literal('')).nullable()
})

const SELECT = 'id, stock_name, keyword, source_url, priority, status, created_by, created_at, updated_at'

const STATUS_ORDER: Record<string, number> = { waiting: 0, in_progress: 1, done: 2 }
const PRIORITY_ORDER: Record<string, number> = { high: 0, normal: 1, low: 2 }

export async function GET(request: Request) {
  try {
    const { supabaseAdmin } = await authedContext(request)

    const [{ data: rows, error }, recentStocks] = await Promise.all([
      supabaseAdmin.from(V2_TABLES.keywordRadar).select(SELECT).order('created_at', { ascending: false }).limit(300),
      loadRecentStocks(supabaseAdmin)
    ])

    if (error) {
      if (isMissingTableError(error)) return NextResponse.json(sampleKeywordsPayload())
      return errorResponse(error, '키워드 레이더 조회 실패')
    }

    const staffMap = await loadStaffMap(supabaseAdmin)
    const items: KeywordRadarItem[] = ((rows || []) as Omit<KeywordRadarItem, 'created_by_name'>[])
      .map((row) => ({ ...row, created_by_name: row.created_by ? staffMap.get(row.created_by) || null : null }))
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          (a.created_at < b.created_at ? 1 : -1)
      )

    const payload: KeywordsPayload = { items, recentStocks }
    return NextResponse.json(payload)
  } catch (e) {
    return handleRouteError(e, '키워드 레이더 조회 실패')
  }
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json())
    const { profile, supabaseAdmin } = await authedContext(request)

    const { data, error } = await supabaseAdmin
      .from(V2_TABLES.keywordRadar)
      .insert({
        stock_name: body.stockName,
        keyword: body.keyword,
        source_url: body.sourceUrl || null,
        priority: body.priority,
        status: 'waiting',
        created_by: profile.id,
        created_at: nowIso(),
        updated_at: nowIso()
      })
      .select(SELECT)
      .single()
    if (error || !data) return handleDbError(error, '키워드 등록 실패')
    return NextResponse.json({ ok: true, item: data })
  } catch (e) {
    return handleRouteError(e, '키워드 등록 실패')
  }
}

export async function PATCH(request: Request) {
  try {
    const body = patchSchema.parse(await request.json())
    const { profile, supabaseAdmin, isAdmin } = await authedContext(request)

    const { data: existing, error: loadError } = await supabaseAdmin
      .from(V2_TABLES.keywordRadar)
      .select('id, created_by')
      .eq('id', body.id)
      .maybeSingle()
    if (loadError) return handleDbError(loadError, '키워드 조회 실패')
    if (!existing) return NextResponse.json({ error: '키워드를 찾을 수 없습니다.' }, { status: 404 })
    if (!isAdmin && existing.created_by !== profile.id) return forbidden('본인이 등록한 키워드만 수정할 수 있습니다.')

    const patch: Record<string, unknown> = { updated_at: nowIso() }
    if (body.status !== undefined) patch.status = body.status
    if (body.priority !== undefined) patch.priority = body.priority
    if (body.stockName !== undefined) patch.stock_name = body.stockName
    if (body.keyword !== undefined) patch.keyword = body.keyword
    if (body.sourceUrl !== undefined) patch.source_url = body.sourceUrl || null

    const { data, error } = await supabaseAdmin.from(V2_TABLES.keywordRadar).update(patch).eq('id', body.id).select(SELECT).single()
    if (error || !data) return handleDbError(error, '키워드 수정 실패')
    return NextResponse.json({ ok: true, item: data })
  } catch (e) {
    return handleRouteError(e, '키워드 수정 실패')
  }
}

export async function DELETE(request: Request) {
  try {
    const { profile, supabaseAdmin, isAdmin } = await authedContext(request)
    const id = new URL(request.url).searchParams.get('id') || ''
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: '삭제할 키워드 ID가 올바르지 않습니다.' }, { status: 400 })
    }
    const { data: existing, error: loadError } = await supabaseAdmin.from(V2_TABLES.keywordRadar).select('id, created_by').eq('id', id).maybeSingle()
    if (loadError) {
      if (isMissingTableError(loadError)) return missingTableResponse()
      return errorResponse(loadError, '키워드 삭제 실패')
    }
    if (!existing) return NextResponse.json({ ok: true })
    if (!isAdmin && existing.created_by !== profile.id) return forbidden('본인이 등록한 키워드만 삭제할 수 있습니다.')

    const { error } = await supabaseAdmin.from(V2_TABLES.keywordRadar).delete().eq('id', id)
    if (error) return handleDbError(error, '키워드 삭제 실패')
    return NextResponse.json({ ok: true })
  } catch (e) {
    return handleRouteError(e, '키워드 삭제 실패')
  }
}
