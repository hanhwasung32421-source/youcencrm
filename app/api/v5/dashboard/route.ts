import { NextResponse } from 'next/server'
import { V5_TABLES } from '@/lib/v5/tables'
import { SAMPLE_ACTIVITIES, SAMPLE_CONTRACTS, SAMPLE_DEALS, SAMPLE_PARTNERS } from '@/lib/v5/sample-data'
import { computeDashboard } from '@/lib/v5/dashboard'
import type { Activity, Contract, DashboardData, Deal, Partner } from '@/lib/v5/types'
import { forbidden, getSession, handleRouteError, isMissingTableError, loadUserMap } from '@/lib/v5/api'

// 컴플라이언스 미완료 = 전체 영상 수 - 통과한 체크 수. 체크 테이블이 없으면 전체 영상 수.
async function countComplianceIncomplete(supabaseAdmin: Awaited<ReturnType<typeof getSession>>['supabaseAdmin']) {
  const { count: videoCount } = await supabaseAdmin.from(V5_TABLES.videos).select('id', { count: 'exact', head: true })
  const total = videoCount || 0
  const { count: passed, error } = await supabaseAdmin
    .from(V5_TABLES.complianceChecks)
    .select('id', { count: 'exact', head: true })
    .eq('status', 'passed')
  if (error) return total
  return Math.max(total - (passed || 0), 0)
}

export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    if (!session.isAdmin) return forbidden()
    const { supabaseAdmin } = session

    const { data: partners, error } = await supabaseAdmin.from(V5_TABLES.partners).select('*')
    if (error) {
      if (isMissingTableError(error)) {
        const data: DashboardData = {
          sample: true,
          ...computeDashboard({
            partners: SAMPLE_PARTNERS,
            deals: SAMPLE_DEALS,
            contracts: SAMPLE_CONTRACTS,
            activities: SAMPLE_ACTIVITIES,
            complianceIncomplete: 7
          })
        }
        return NextResponse.json(data)
      }
      throw error
    }

    const [{ data: deals }, { data: contracts }, { data: activities }, complianceIncomplete] = await Promise.all([
      supabaseAdmin.from(V5_TABLES.deals).select('*'),
      supabaseAdmin.from(V5_TABLES.contracts).select('*'),
      supabaseAdmin.from(V5_TABLES.activities).select('*').order('occurred_at', { ascending: false }).limit(60),
      countComplianceIncomplete(supabaseAdmin)
    ])

    const partnerRows = (partners || []) as Partner[]
    const dealRows = (deals || []) as Deal[]
    const contractRows = (contracts || []) as Contract[]
    const activityRows = (activities || []) as Activity[]
    const partnerName = (id: string | null) => partnerRows.find((p) => p.id === id)?.company_name || null
    const userMap = await loadUserMap(supabaseAdmin, [...dealRows.map((d) => d.owner_user_id), ...activityRows.map((a) => a.created_by)])

    const data: DashboardData = {
      sample: false,
      ...computeDashboard({
        partners: partnerRows,
        deals: dealRows.map((d) => ({ ...d, partner_name: partnerName(d.partner_id) || '', owner_name: d.owner_user_id ? userMap.get(d.owner_user_id) || null : null })),
        contracts: contractRows.map((c) => ({ ...c, partner_name: partnerName(c.partner_id) || '' })),
        activities: activityRows.map((a) => ({
          ...a,
          partner_name: partnerName(a.partner_id),
          deal_name: dealRows.find((d) => d.id === a.deal_id)?.campaign_name || null,
          author_name: a.created_by ? userMap.get(a.created_by) || null : null
        })),
        complianceIncomplete
      })
    }
    return NextResponse.json(data)
  } catch (e) {
    return handleRouteError(e, '대시보드 조회 실패')
  }
}
