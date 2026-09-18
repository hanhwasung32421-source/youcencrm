import { NextResponse } from 'next/server'
import { z } from 'zod'
import { errorResponse } from '@/lib/api/error-response'
import { V3_TABLES } from '@/lib/v3/tables'
import { EXPENSE_TYPES, getCurrentMonth, isValidMonth, lastNMonths, type ExpenseEntry } from '@/lib/v3/finance'
import { authenticateAdmin, isMissingTableError, missingTableResponse, readJson } from '@/lib/v3/server'
import { sampleExpenseEntries } from '@/lib/v3/sample-data'

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '월 형식은 YYYY-MM 이어야 합니다.')

const createSchema = z.object({
  month: monthSchema,
  expense_type: z.enum(EXPENSE_TYPES),
  amount: z.number().int().min(0).max(1_000_000_000_000),
  memo: z.string().max(500).nullable().optional()
})

const updateSchema = createSchema.partial().extend({ id: z.string().uuid() })

// GET /api/v3/expense-entries?month=YYYY-MM  (생략 시 최근 12개월)
export async function GET(request: Request) {
  const auth = await authenticateAdmin(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin } = auth

  try {
    const monthParam = new URL(request.url).searchParams.get('month')
    const month = isValidMonth(monthParam) ? monthParam : null
    const months = month ? [month] : lastNMonths(getCurrentMonth(), 12)

    const { data, error } = await supabaseAdmin
      .from(V3_TABLES.expenseEntries)
      .select('*')
      .in('month', months)
      .order('month', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({ sample: true, months, entries: sampleExpenseEntries().filter((row) => months.includes(row.month)) })
      }
      throw new Error(error.message)
    }

    const entries = ((data || []) as ExpenseEntry[]).map((row) => ({ ...row, amount: Number(row.amount) }))
    return NextResponse.json({ sample: false, months, entries })
  } catch (e) {
    return errorResponse(e, '비용 항목 조회에 실패했습니다.')
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
      .from(V3_TABLES.expenseEntries)
      .insert({
        month: body.month,
        expense_type: body.expense_type,
        amount: body.amount,
        memo: body.memo?.trim() || null,
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
    return errorResponse(e, '비용 항목 저장에 실패했습니다.')
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
    const patch: Record<string, unknown> = {}
    if (rest.month !== undefined) patch.month = rest.month
    if (rest.expense_type !== undefined) patch.expense_type = rest.expense_type
    if (rest.amount !== undefined) patch.amount = rest.amount
    if (rest.memo !== undefined) patch.memo = rest.memo?.trim() || null

    const { data, error } = await supabaseAdmin.from(V3_TABLES.expenseEntries).update(patch).eq('id', id).select('*').single()
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw new Error(error.message)
    }
    return NextResponse.json({ entry: data })
  } catch (e) {
    return errorResponse(e, '비용 항목 수정에 실패했습니다.')
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
    const { error } = await supabaseAdmin.from(V3_TABLES.expenseEntries).delete().eq('id', id)
    if (error) {
      if (isMissingTableError(error)) return missingTableResponse()
      throw new Error(error.message)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e, '비용 항목 삭제에 실패했습니다.')
  }
}
