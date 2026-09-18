import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { V3_TABLES } from '@/lib/v3/tables'
import { INVOICE_STATUSES, getCurrentMonth, type SponsorshipInvoice } from '@/lib/v3/finance'
import { authenticateAdmin, isMissingTableError, loadStaffUsers, loadUserNames, missingTableResponse, readJson } from '@/lib/v3/server'
import { sampleSponsorshipInvoices, SAMPLE_STAFF } from '@/lib/v3/sample-data'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD 이어야 합니다.').nullable().optional()

const createSchema = z.object({
  advertiser_name: z.string().trim().min(1, '광고주명을 입력해 주세요.').max(120),
  campaign_name: z.string().trim().min(1, '캠페인명을 입력해 주세요.').max(200),
  contract_amount: z.number().int().min(0).max(1_000_000_000_000),
  staff_user_id: z.string().uuid().nullable().optional(),
  video_url: z.string().url('영상 URL 형식이 올바르지 않습니다.').max(2000).nullable().optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  issued_at: dateSchema,
  due_at: dateSchema,
  paid_at: dateSchema,
  memo: z.string().max(500).nullable().optional()
})

const updateSchema = createSchema.partial().extend({ id: z.string().uuid() })

function todayKst() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function summarize(invoices: SponsorshipInvoice[]) {
  const month = getCurrentMonth()
  const today = todayKst()
  let receivable = 0
  let paidThisMonth = 0
  let overdueCount = 0
  for (const inv of invoices) {
    if (inv.status === 'issued' || inv.status === 'overdue') receivable += inv.contract_amount
    if (inv.status === 'paid' && inv.paid_at && inv.paid_at.slice(0, 7) === month) paidThisMonth += inv.contract_amount
    const isPastDue = inv.status === 'issued' && !!inv.due_at && inv.due_at < today
    if (inv.status === 'overdue' || isPastDue) overdueCount += 1
  }
  return { receivable, paidThisMonth, overdueCount }
}

export async function GET(request: Request) {
  const auth = await authenticateAdmin(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin } = auth

  try {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')

    let query = supabaseAdmin.from(V3_TABLES.sponsorshipInvoices).select('*').order('created_at', { ascending: false })
    if (status && (INVOICE_STATUSES as readonly string[]).includes(status)) query = query.eq('status', status)
    const { data, error } = await query

    if (error) {
      if (isMissingTableError(error)) {
        let rows = sampleSponsorshipInvoices()
        const summary = summarize(rows)
        if (status) rows = rows.filter((row) => row.status === status)
        return NextResponse.json({ sample: true, invoices: rows, summary, staff: SAMPLE_STAFF })
      }
      throw new Error(error.message)
    }

    const [staff, names] = await Promise.all([loadStaffUsers(supabaseAdmin), loadUserNames(supabaseAdmin)])
    const invoices: SponsorshipInvoice[] = ((data || []) as SponsorshipInvoice[]).map((row) => ({
      ...row,
      contract_amount: Number(row.contract_amount),
      staff_name: row.staff_user_id ? names.get(row.staff_user_id) || null : null
    }))

    // 요약은 필터와 무관하게 전체 기준
    let summarySource = invoices
    if (status) {
      const { data: all } = await supabaseAdmin.from(V3_TABLES.sponsorshipInvoices).select('*')
      summarySource = ((all || []) as SponsorshipInvoice[]).map((row) => ({ ...row, contract_amount: Number(row.contract_amount) }))
    }

    return NextResponse.json({
      sample: false,
      invoices,
      summary: summarize(summarySource),
      staff: staff.map((user) => ({ id: user.id, name: user.name }))
    })
  } catch (e) {
    return errorResponse(e, '협찬 인보이스 조회에 실패했습니다.')
  }
}

export async function POST(request: Request) {
  const auth = await authenticateAdmin(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin } = auth

  const parsed = createSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '입력값을 확인해 주세요.' }, { status: 400 })
  }

  try {
    const body = parsed.data
    const status = body.status || 'draft'
    const { data, error } = await supabaseAdmin
      .from(V3_TABLES.sponsorshipInvoices)
      .insert({
        advertiser_name: body.advertiser_name,
        campaign_name: body.campaign_name,
        contract_amount: body.contract_amount,
        staff_user_id: body.staff_user_id || null,
        video_url: body.video_url || null,
        status,
        issued_at: body.issued_at || (status !== 'draft' ? todayKst() : null),
        due_at: body.due_at || null,
        paid_at: body.paid_at || (status === 'paid' ? todayKst() : null),
        memo: body.memo?.trim() || null
      })
      .select('*')
      .single()
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw new Error(error.message)
    }
    return NextResponse.json({ invoice: data })
  } catch (e) {
    return errorResponse(e, '협찬 인보이스 저장에 실패했습니다.')
  }
}

// PATCH: 필드 수정 + 상태 전이. 상태만 바꾸면 발행일/입금일을 자동으로 채운다.
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
    if (rest.advertiser_name !== undefined) patch.advertiser_name = rest.advertiser_name
    if (rest.campaign_name !== undefined) patch.campaign_name = rest.campaign_name
    if (rest.contract_amount !== undefined) patch.contract_amount = rest.contract_amount
    if (rest.staff_user_id !== undefined) patch.staff_user_id = rest.staff_user_id || null
    if (rest.video_url !== undefined) patch.video_url = rest.video_url || null
    if (rest.issued_at !== undefined) patch.issued_at = rest.issued_at || null
    if (rest.due_at !== undefined) patch.due_at = rest.due_at || null
    if (rest.paid_at !== undefined) patch.paid_at = rest.paid_at || null
    if (rest.memo !== undefined) patch.memo = rest.memo?.trim() || null

    if (rest.status !== undefined) {
      patch.status = rest.status
      if (rest.status === 'issued' && rest.issued_at === undefined) {
        const { data: current } = await supabaseAdmin.from(V3_TABLES.sponsorshipInvoices).select('issued_at, due_at').eq('id', id).maybeSingle()
        if (!current?.issued_at) patch.issued_at = todayKst()
        if (!current?.due_at) {
          const due = new Date(Date.now() + 9 * 60 * 60 * 1000)
          due.setUTCDate(due.getUTCDate() + 30)
          patch.due_at = due.toISOString().slice(0, 10)
        }
      }
      if (rest.status === 'paid' && rest.paid_at === undefined) patch.paid_at = todayKst()
      if (rest.status !== 'paid' && rest.paid_at === undefined) patch.paid_at = null
      if (rest.status === 'draft') {
        patch.issued_at = null
        patch.due_at = null
        patch.paid_at = null
      }
    }

    const { data, error } = await supabaseAdmin.from(V3_TABLES.sponsorshipInvoices).update(patch).eq('id', id).select('*').single()
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw new Error(error.message)
    }
    return NextResponse.json({ invoice: data })
  } catch (e) {
    return errorResponse(e, '협찬 인보이스 수정에 실패했습니다.')
  }
}

export async function DELETE(request: Request) {
  const auth = await authenticateAdmin(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin } = auth

  const id = new URL(request.url).searchParams.get('id')
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: '삭제할 인보이스 id가 필요합니다.' }, { status: 400 })
  }

  try {
    const { error } = await supabaseAdmin.from(V3_TABLES.sponsorshipInvoices).delete().eq('id', id)
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw new Error(error.message)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e, '협찬 인보이스 삭제에 실패했습니다.')
  }
}
