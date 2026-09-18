import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/api/error-response'
import { V3_TABLES } from '@/lib/v3/tables'
import {
  getCurrentMonth,
  isValidMonth,
  lastNMonths,
  pctChange,
  shiftMonth,
  STREAM_LABELS,
  sumExpenses,
  sumStreams,
  VIEW_SHARED_STREAMS,
  type ExpenseEntry,
  type RevenueEntry,
  type SponsorshipInvoice,
  type StreamType
} from '@/lib/v3/finance'
import {
  authenticateAdmin,
  computeMonthlySettlements,
  isMissingTableError,
  loadUserNames,
  loadVideosForMonth,
  sumIncentives
} from '@/lib/v3/server'
import { sampleExpenseEntries, sampleRevenueEntries, sampleSponsorshipInvoices } from '@/lib/v3/sample-data'

const krw = new Intl.NumberFormat('ko-KR')

// 영상별 매출 귀속 공식
//   조회수 비례 스트림(애드센스·멤버십·슈퍼챗·리딩 상품·기타)의 월 합계 P 에 대해
//   영상 v 의 귀속 매출 = P × ( v.조회수 / Σ 해당 월 등록 영상 조회수 )
//   협찬·광고는 계약 단위라 영상에는 배분하지 않고, 인보이스의 담당 직원에게 직접 귀속한다.
// 직원별 귀속 매출 = Σ 본인 영상 귀속 매출 + Σ 본인 담당 인보이스 계약금액(초안 제외, 발행월 = 선택 월)
export async function GET(request: Request) {
  const auth = await authenticateAdmin(request)
  if (!auth.ok) return auth.response
  const { supabaseAdmin } = auth

  try {
    const monthParam = new URL(request.url).searchParams.get('month')
    const month = isValidMonth(monthParam) ? monthParam : getCurrentMonth()
    const previous = shiftMonth(month, -1)
    const trendMonths = lastNMonths(month, 12)
    const months = Array.from(new Set([...trendMonths, previous]))

    let sample = false

    // 매출
    const revenueRes = await supabaseAdmin.from(V3_TABLES.revenueEntries).select('month, stream_type, amount').in('month', months)
    let revenueRows: Pick<RevenueEntry, 'month' | 'stream_type' | 'amount'>[]
    if (revenueRes.error) {
      if (!isMissingTableError(revenueRes.error)) throw new Error(revenueRes.error.message)
      sample = true
      revenueRows = sampleRevenueEntries().filter((row) => months.includes(row.month))
    } else {
      revenueRows = (revenueRes.data || []).map((row: any) => ({ ...row, amount: Number(row.amount) }))
    }

    // 비용
    const expenseRes = await supabaseAdmin.from(V3_TABLES.expenseEntries).select('month, expense_type, amount').in('month', [month, previous])
    let expenseRows: Pick<ExpenseEntry, 'month' | 'expense_type' | 'amount'>[]
    if (expenseRes.error) {
      if (!isMissingTableError(expenseRes.error)) throw new Error(expenseRes.error.message)
      sample = true
      expenseRows = sampleExpenseEntries().filter((row) => row.month === month || row.month === previous)
    } else {
      expenseRows = (expenseRes.data || []).map((row: any) => ({ ...row, amount: Number(row.amount) }))
    }

    // 협찬 인보이스(직원 귀속용)
    const invoiceRes = await supabaseAdmin.from(V3_TABLES.sponsorshipInvoices).select('staff_user_id, contract_amount, status, issued_at, created_at')
    let invoices: Pick<SponsorshipInvoice, 'staff_user_id' | 'contract_amount' | 'status' | 'issued_at' | 'created_at'>[]
    if (invoiceRes.error) {
      if (!isMissingTableError(invoiceRes.error)) throw new Error(invoiceRes.error.message)
      sample = true
      invoices = sampleSponsorshipInvoices()
    } else {
      invoices = (invoiceRes.data || []).map((row: any) => ({ ...row, contract_amount: Number(row.contract_amount) }))
    }

    // 인센티브(실데이터) + 영상
    const [{ rows: settlementRows }, { rows: prevSettlementRows }, videos, names] = await Promise.all([
      computeMonthlySettlements(supabaseAdmin, month),
      computeMonthlySettlements(supabaseAdmin, previous),
      loadVideosForMonth(supabaseAdmin, month),
      loadUserNames(supabaseAdmin)
    ])

    const revenueByStream = sumStreams(revenueRows.filter((row) => row.month === month))
    const prevRevenueByStream = sumStreams(revenueRows.filter((row) => row.month === previous))
    const revenueTotal = Object.values(revenueByStream).reduce((a, b) => a + b, 0)
    const prevRevenueTotal = Object.values(prevRevenueByStream).reduce((a, b) => a + b, 0)
    const expenseTotal = Object.values(sumExpenses(expenseRows.filter((row) => row.month === month))).reduce((a, b) => a + b, 0)
    const prevExpenseTotal = Object.values(sumExpenses(expenseRows.filter((row) => row.month === previous))).reduce((a, b) => a + b, 0)
    const incentiveTotal = sumIncentives(settlementRows)
    const prevIncentiveTotal = sumIncentives(prevSettlementRows)
    const netProfit = revenueTotal - expenseTotal - incentiveTotal
    const prevNetProfit = prevRevenueTotal - prevExpenseTotal - prevIncentiveTotal

    // 12개월 추이(스트림별 스택)
    const trend = trendMonths.map((m) => {
      const byStream = sumStreams(revenueRows.filter((row) => row.month === m))
      return { month: m, byStream, total: Object.values(byStream).reduce((a, b) => a + b, 0) }
    })

    // 영상별 귀속 매출
    const pool = VIEW_SHARED_STREAMS.reduce((sum, stream) => sum + revenueByStream[stream], 0)
    const totalViews = videos.reduce((sum, video) => sum + Number(video.view_count || 0), 0)
    const attributed = videos.map((video) => {
      const views = Number(video.view_count || 0)
      const revenue = totalViews > 0 ? Math.round((pool * views) / totalViews) : 0
      return {
        id: video.id,
        title: video.title || video.stock_name || '(제목 없음)',
        stock_name: video.stock_name,
        content_type: video.content_type,
        owner_user_id: video.primary_owner_user_id,
        owner_name: names.get(video.primary_owner_user_id) || '—',
        view_count: views,
        youtube_url: video.youtube_url,
        revenue
      }
    })
    const topVideos = [...attributed].sort((a, b) => b.revenue - a.revenue || b.view_count - a.view_count).slice(0, 5)

    // 직원별 귀속 매출
    const staffRevenue = new Map<string, { userId: string; name: string; videoRevenue: number; sponsorshipRevenue: number; videoCount: number; views: number }>()
    for (const row of attributed) {
      const entry = staffRevenue.get(row.owner_user_id) || {
        userId: row.owner_user_id,
        name: row.owner_name,
        videoRevenue: 0,
        sponsorshipRevenue: 0,
        videoCount: 0,
        views: 0
      }
      entry.videoRevenue += row.revenue
      entry.videoCount += 1
      entry.views += row.view_count
      staffRevenue.set(row.owner_user_id, entry)
    }
    for (const inv of invoices) {
      if (!inv.staff_user_id || inv.status === 'draft') continue
      const invMonth = (inv.issued_at || inv.created_at || '').slice(0, 7)
      if (invMonth !== month) continue
      const entry = staffRevenue.get(inv.staff_user_id) || {
        userId: inv.staff_user_id,
        name: names.get(inv.staff_user_id) || (sample ? sampleStaffName(inv.staff_user_id) : '—'),
        videoRevenue: 0,
        sponsorshipRevenue: 0,
        videoCount: 0,
        views: 0
      }
      entry.sponsorshipRevenue += inv.contract_amount
      staffRevenue.set(inv.staff_user_id, entry)
    }
    const topStaff = Array.from(staffRevenue.values())
      .map((row) => ({ ...row, total: row.videoRevenue + row.sponsorshipRevenue }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)

    // 매출 비중
    const mix = (Object.keys(revenueByStream) as StreamType[])
      .map((stream) => ({ stream, label: STREAM_LABELS[stream], amount: revenueByStream[stream], share: revenueTotal > 0 ? revenueByStream[stream] / revenueTotal : 0 }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    // 한글 요약
    const change = pctChange(revenueTotal, prevRevenueTotal)
    const top = mix[0]
    const marginPct = revenueTotal > 0 ? (netProfit / revenueTotal) * 100 : null
    const summaryParts = [
      `이번 달 총매출 ₩${krw.format(revenueTotal)}` + (change === null ? '' : ` (전월 대비 ${change >= 0 ? '+' : ''}${change.toFixed(1)}%)`),
      top ? `가장 큰 수익원은 ${top.label} ₩${krw.format(top.amount)} (${(top.share * 100).toFixed(0)}%)` : '아직 등록된 수익원 항목이 없습니다',
      `비용 ₩${krw.format(expenseTotal)}과 인센티브 ₩${krw.format(incentiveTotal)}을 제하면 순이익은 ₩${krw.format(netProfit)}` +
        (marginPct === null ? '' : ` (마진 ${marginPct.toFixed(1)}%)`) +
        '입니다',
      topStaff[0] ? `귀속 매출 1위 직원은 ${topStaff[0].name} (₩${krw.format(topStaff[0].total)})` : ''
    ].filter(Boolean)

    return NextResponse.json({
      sample,
      month,
      previousMonth: previous,
      summary: summaryParts.join('. ') + '.',
      kpis: {
        revenueTotal: { current: revenueTotal, previous: prevRevenueTotal },
        adsense: { current: revenueByStream.adsense, previous: prevRevenueByStream.adsense },
        membershipSuperchat: {
          current: revenueByStream.membership + revenueByStream.superchat,
          previous: prevRevenueByStream.membership + prevRevenueByStream.superchat
        },
        sponsorship: { current: revenueByStream.sponsorship, previous: prevRevenueByStream.sponsorship },
        leadingProduct: { current: revenueByStream.leading_product, previous: prevRevenueByStream.leading_product },
        expense: { current: expenseTotal, previous: prevExpenseTotal },
        incentive: { current: incentiveTotal, previous: prevIncentiveTotal },
        netProfit: { current: netProfit, previous: prevNetProfit }
      },
      revenueByStream,
      prevRevenueByStream,
      trend,
      mix,
      attribution: { pool, totalViews, videoCount: videos.length },
      topVideos,
      topStaff
    })
  } catch (e) {
    return errorResponse(e, '매출 대시보드 조회에 실패했습니다.')
  }
}

function sampleStaffName(id: string) {
  const map: Record<string, string> = {
    'sample-staff-1': '김도현',
    'sample-staff-2': '이서연',
    'sample-staff-3': '박준서',
    'sample-staff-4': '최지우',
    'sample-staff-5': '정하윤',
    'sample-staff-6': '한민재'
  }
  return map[id] || '—'
}
