// 대시보드 집계(순수 함수). 실데이터/샘플데이터 모두 같은 함수로 계산한다.

import { addDays, todayYmd } from '@/lib/v5/format'
import {
  DEAL_STAGE_LABEL,
  FUNNEL_STAGES,
  OPEN_DEAL_STAGES,
  PARTNER_GRADES,
  type Activity,
  type Contract,
  type DashboardData,
  type Deal,
  type Partner,
  type UpcomingEvent
} from '@/lib/v5/types'

export function computeDashboard(input: {
  partners: Partner[]
  deals: Deal[]
  contracts: Contract[]
  activities: Activity[]
  complianceIncomplete: number
}): Omit<DashboardData, 'sample'> {
  const today = todayYmd()
  const in14 = addDays(today, 14)
  const in30 = addDays(today, 30)
  const monthPrefix = today.slice(0, 7)

  const activePartners = input.partners.filter((p) => p.status === 'active').length
  const openDeals = input.deals.filter((d) => OPEN_DEAL_STAGES.includes(d.stage))
  // 이번 달 예상 계약액: 진행 중 딜 중 예정 게시일이 이번 달인 것 + 이번 달 시작하는 계약(초안/서명) 금액
  const monthExpectedAmount =
    openDeals.filter((d) => d.planned_publish_on?.startsWith(monthPrefix)).reduce((s, d) => s + (d.expected_amount || 0), 0) +
    input.contracts
      .filter((c) => (c.status === 'draft' || c.status === 'signed') && c.starts_on.startsWith(monthPrefix))
      .reduce((s, c) => s + (c.amount || 0), 0)
  const expiringContracts30d = input.contracts.filter(
    (c) => c.status !== 'expired' && c.ends_on >= today && c.ends_on <= in30
  ).length

  const funnel = FUNNEL_STAGES.map((stage) => {
    const rows = input.deals.filter((d) => d.stage === stage)
    return { stage, count: rows.length, amount: rows.reduce((s, d) => s + (d.expected_amount || 0), 0) }
  })
  const lostCount = input.deals.filter((d) => d.stage === 'lost').length

  const upcoming: UpcomingEvent[] = []
  for (const c of input.contracts) {
    if (c.status !== 'expired' && c.ends_on >= today && c.ends_on <= in14) {
      upcoming.push({
        kind: 'contract_end',
        label: '계약 만료',
        date: c.ends_on,
        title: c.campaign_name,
        subtitle: c.partner_name || '',
        href: '/v5/contracts'
      })
    }
  }
  for (const d of input.deals) {
    if (!OPEN_DEAL_STAGES.includes(d.stage)) continue
    if (d.planned_publish_on && d.planned_publish_on >= today && d.planned_publish_on <= in14) {
      upcoming.push({
        kind: 'publish',
        label: '집행 예정',
        date: d.planned_publish_on,
        title: d.campaign_name,
        subtitle: `${d.partner_name || ''} · ${DEAL_STAGE_LABEL[d.stage]}`,
        href: '/v5/deals'
      })
    }
    if (d.next_action_on && d.next_action_on >= today && d.next_action_on <= in14 && d.next_action) {
      upcoming.push({
        kind: 'next_action',
        label: '다음 액션',
        date: d.next_action_on,
        title: d.next_action,
        subtitle: `${d.campaign_name}${d.owner_name ? ` · ${d.owner_name}` : ''}`,
        href: '/v5/deals'
      })
    }
  }
  for (const a of input.activities) {
    if (a.next_step && a.next_step_on && a.next_step_on >= today && a.next_step_on <= in14) {
      upcoming.push({
        kind: 'next_step',
        label: a.activity_type === 'meeting' ? '미팅 후속' : '후속 할 일',
        date: a.next_step_on,
        title: a.next_step,
        subtitle: a.partner_name || a.deal_name || '',
        href: '/v5/activities'
      })
    }
  }
  upcoming.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const recentActivities = [...input.activities]
    .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))
    .slice(0, 8)

  const gradeDistribution = PARTNER_GRADES.map((grade) => ({
    grade,
    count: input.partners.filter((p) => p.grade === grade && p.status !== 'closed').length
  }))

  return {
    kpis: {
      activePartners,
      openDeals: openDeals.length,
      monthExpectedAmount,
      expiringContracts30d,
      complianceIncomplete: input.complianceIncomplete
    },
    funnel,
    lostCount,
    upcoming: upcoming.slice(0, 12),
    recentActivities,
    gradeDistribution
  }
}
