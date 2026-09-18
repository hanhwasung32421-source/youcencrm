import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/api/error-response'
import { V3_TABLES } from '@/lib/v3/tables'
import {
  buildPnl,
  getCurrentMonth,
  isValidMonth,
  lastNMonths,
  shiftMonth,
  sumExpenses,
  sumStreams,
  type ExpenseEntry,
  type RevenueEntry
} from '@/lib/v3/finance'
import { authenticateAdmin, computeMonthlySettlements, isMissingTableError, sumIncentives } from '@/lib/v3/server'
import { sampleExpenseEntries, sampleRevenueEntries } from '@/lib/v3/sample-data'

// GET /api/v3/pnl?month=YYYY-MM
// 월간 손익계산서: 매출(스트림별) − 비용(유형별) − 인센티브 = 순이익. 전월 비교와 6개월 순이익 추이 포함.
export async function GET(request: Request) {
  const auth = await authenticateAdmin(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin } = auth

  try {
    const monthParam = new URL(request.url).searchParams.get('month')
    const month = isValidMonth(monthParam) ? monthParam : getCurrentMonth()
    const trendMonths = lastNMonths(month, 6)
    const previous = shiftMonth(month, -1)
    const months = Array.from(new Set([...trendMonths, previous]))

    let sample = false

    const revenueRes = await supabaseAdmin.from(V3_TABLES.revenueEntries).select('month, stream_type, amount').in('month', months)
    let revenueRows: Pick<RevenueEntry, 'month' | 'stream_type' | 'amount'>[]
    if (revenueRes.error) {
      if (!isMissingTableError(revenueRes.error)) throw new Error(revenueRes.error.message)
      sample = true
      revenueRows = sampleRevenueEntries().filter((row) => months.includes(row.month))
    } else {
      revenueRows = (revenueRes.data || []).map((row: any) => ({ ...row, amount: Number(row.amount) }))
    }

    const expenseRes = await supabaseAdmin.from(V3_TABLES.expenseEntries).select('month, expense_type, amount').in('month', months)
    let expenseRows: Pick<ExpenseEntry, 'month' | 'expense_type' | 'amount'>[]
    if (expenseRes.error) {
      if (!isMissingTableError(expenseRes.error)) throw new Error(expenseRes.error.message)
      sample = true
      expenseRows = sampleExpenseEntries().filter((row) => months.includes(row.month))
    } else {
      expenseRows = (expenseRes.data || []).map((row: any) => ({ ...row, amount: Number(row.amount) }))
    }

    // 인센티브는 실제 영상 데이터로 월별 계산(확정분 우선)
    const incentiveByMonth = new Map<string, number>()
    await Promise.all(
      months.map(async (m) => {
        const { rows } = await computeMonthlySettlements(supabaseAdmin, m)
        incentiveByMonth.set(m, sumIncentives(rows))
      })
    )

    const statementFor = (m: string) =>
      buildPnl(
        m,
        sumStreams(revenueRows.filter((row) => row.month === m)),
        sumExpenses(expenseRows.filter((row) => row.month === m)),
        incentiveByMonth.get(m) || 0
      )

    const statement = statementFor(month)
    const previousStatement = statementFor(previous)
    const trend = trendMonths.map((m) => {
      const s = statementFor(m)
      return { month: m, revenue: s.revenueTotal, expense: s.expenseTotal, incentive: s.incentiveTotal, net: s.netProfit }
    })

    return NextResponse.json({ sample, month, statement, previous: previousStatement, trend })
  } catch (e) {
    return errorResponse(e, '손익계산서 조회에 실패했습니다.')
  }
}
