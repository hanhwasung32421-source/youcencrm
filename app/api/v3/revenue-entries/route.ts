import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { V3_TABLES } from '@/lib/v3/tables'
import { isValidMonth, lastNMonths, getCurrentMonth, STREAM_TYPES, type RevenueEntry } from '@/lib/v3/finance'
import { authenticateAdmin, isMissingTableError, missingTableResponse, readJson } from '@/lib/v3/server'
import { sampleRevenueEntries, SAMPLE_CHANNELS } from '@/lib/v3/sample-data'
import { SHARED_TABLES } from '@/lib/v3/tables'

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '월 형식은 YYYY-MM 이어야 합니다.')
const urlSchema = z.string().url('증빙 URL 형식이 올바르지 않습니다.').max(2000).nullable().optional()

const createSchema = z.object({
  month: monthSchema,
  stream_type: z.enum(STREAM_TYPES),
  channel_id: z.string().uuid().nullable().optional(),
  amount: z.number().int().min(0).max(1_000_000_000_000),
  memo: z.string().max(500).nullable().optional(),
  evidence_url: urlSchema
})

const updateSchema = createSchema.partial().extend({ id: z.string().uuid() })

// GET /api/v3/revenue-entries?month=YYYY-MM  (month 생략 시 최근 12개월 전체)
export async function GET(request: Request) {
  const auth = await authenticateAdmin(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin } = auth

  try {
    const url = new URL(request.url)
    const monthParam = url.searchParams.get('month')
    const month = isValidMonth(monthParam) ? monthParam : null
    const months = month ? [month] : lastNMonths(getCurrentMonth(), 12)

    const { data, error } = await supabaseAdmin
      .from(V3_TABLES.revenueEntries)
      .select('*')
      .in('month', months)
      .order('month', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      if (isMissingTableError(error)) {
        const rows = sampleRevenueEntries().filter((row) => months.includes(row.month))
        return NextResponse.json({ sample: true, months, entries: rows, channels: SAMPLE_CHANNELS })
      }
      throw new Error(error.message)
    }

    const { data: channelRows } = await supabaseAdmin.from(SHARED_TABLES.channels).select('id, name').order('name')
    const channels = (channelRows || []) as { id: string; name: string }[]
    const channelNames = new Map(channels.map((c) => [c.id, c.name]))

    const entries: RevenueEntry[] = ((data || []) as RevenueEntry[]).map((row) => ({
      ...row,
      amount: Number(row.amount),
      channel_name: row.channel_id ? channelNames.get(row.channel_id) || null : null
    }))

    return NextResponse.json({ sample: false, months, entries, channels })
  } catch (e) {
    return errorResponse(e, '수익원 항목 조회에 실패했습니다.')
  }
}

export async function POST(request: Request) {
  const auth = await authenticateAdmin(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin, profile } = auth

  const parsed = createSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '입력값을 확인해 주세요.' }, { status: 400 })
  }

  try {
    const body = parsed.data
    const { data, error } = await supabaseAdmin
      .from(V3_TABLES.revenueEntries)
      .insert({
        month: body.month,
        stream_type: body.stream_type,
        channel_id: body.channel_id || null,
        amount: body.amount,
        memo: body.memo?.trim() || null,
        evidence_url: body.evidence_url || null,
        created_by: profile.id
      })
      .select('*')
      .single()
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw new Error(error.message)
    }
    return NextResponse.json({ entry: data })
  } catch (e) {
    return errorResponse(e, '수익원 항목 저장에 실패했습니다.')
  }
}

export async function PATCH(request: Request) {
  const auth = await authenticateAdmin(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin } = auth

  const parsed = updateSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '입력값을 확인해 주세요.' }, { status: 400 })
  }

  try {
    const { id, ...rest } = parsed.data
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (rest.month !== undefined) patch.month = rest.month
    if (rest.stream_type !== undefined) patch.stream_type = rest.stream_type
    if (rest.channel_id !== undefined) patch.channel_id = rest.channel_id || null
    if (rest.amount !== undefined) patch.amount = rest.amount
    if (rest.memo !== undefined) patch.memo = rest.memo?.trim() || null
    if (rest.evidence_url !== undefined) patch.evidence_url = rest.evidence_url || null

    const { data, error } = await supabaseAdmin.from(V3_TABLES.revenueEntries).update(patch).eq('id', id).select('*').single()
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw new Error(error.message)
    }
    return NextResponse.json({ entry: data })
  } catch (e) {
    return errorResponse(e, '수익원 항목 수정에 실패했습니다.')
  }
}

export async function DELETE(request: Request) {
  const auth = await authenticateAdmin(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin } = auth

  const id = new URL(request.url).searchParams.get('id')
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: '삭제할 항목 id가 필요합니다.' }, { status: 400 })
  }

  try {
    const { error } = await supabaseAdmin.from(V3_TABLES.revenueEntries).delete().eq('id', id)
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw new Error(error.message)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e, '수익원 항목 삭제에 실패했습니다.')
  }
}
