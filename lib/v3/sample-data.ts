// V3 테이블(supabase/sql/v3/100_v3_revenue.sql)이 아직 생성되지 않았을 때
// GET API가 돌려주는 샘플 데이터. 항상 "현재 월" 기준으로 최근 12개월을 만들고,
// 시드 기반 난수를 써서 새로고침해도 같은 숫자가 나오게 한다.

import {
  EXPENSE_TYPES,
  getCurrentMonth,
  lastNMonths,
  shiftMonth,
  type ExpenseEntry,
  type ExpenseType,
  type IncentiveRule,
  type IncentiveSettlement,
  type RevenueEntry,
  type SponsorshipInvoice,
  type StreamType
} from '@/lib/v3/finance'

export const SAMPLE_STAFF = [
  { id: 'sample-staff-1', name: '김도현' },
  { id: 'sample-staff-2', name: '이서연' },
  { id: 'sample-staff-3', name: '박준서' },
  { id: 'sample-staff-4', name: '최지우' },
  { id: 'sample-staff-5', name: '정하윤' },
  { id: 'sample-staff-6', name: '한민재' }
]

export const SAMPLE_CHANNELS = [
  { id: 'sample-channel-1', name: '여왕개미 주식TV' },
  { id: 'sample-channel-2', name: '여왕개미 숏스' }
]

const ADVERTISERS = ['키움증권', '미래에셋증권', '토스증권', '한국투자증권', 'NH투자증권', '삼성증권', '카카오페이증권', 'KB증권']
const CAMPAIGNS = ['신규 계좌 개설 프로모션', 'MTS 리뉴얼 홍보', '해외주식 수수료 이벤트', 'ISA 계좌 캠페인', '연금저축 브랜디드 콘텐츠', 'ETF 라인업 소개']

function seeded(seed: number) {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

function monthSeed(month: string, salt: number) {
  const [y, m] = month.split('-').map(Number)
  return y * 100 + m + salt * 7919
}

function roundTo(value: number, unit: number) {
  return Math.round(value / unit) * unit
}

// 스트림별 월 기준 금액(원). 완만한 성장 추세 + 시드 난수 진동
const STREAM_BASE: Record<StreamType, number> = {
  adsense: 5_200_000,
  membership: 1_900_000,
  superchat: 720_000,
  sponsorship: 3_600_000,
  leading_product: 4_800_000,
  other: 260_000
}

export function sampleRevenueEntries(): RevenueEntry[] {
  const current = getCurrentMonth()
  const months = lastNMonths(current, 12)
  const rows: RevenueEntry[] = []

  months.forEach((month, index) => {
    const growth = 1 + index * 0.018
    for (const stream of Object.keys(STREAM_BASE) as StreamType[]) {
      const rand = seeded(monthSeed(month, STREAM_BASE[stream] % 97))
      const wobble = 0.85 + rand() * 0.3
      // 협찬은 어떤 달은 아예 없을 수도 있다
      if (stream === 'sponsorship' && rand() < 0.15) continue
      const amount = roundTo(STREAM_BASE[stream] * growth * wobble, 10_000)
      const channel = stream === 'superchat' || stream === 'membership' ? SAMPLE_CHANNELS[0] : rand() > 0.7 ? SAMPLE_CHANNELS[1] : SAMPLE_CHANNELS[0]
      rows.push({
        id: `sample-rev-${month}-${stream}`,
        month,
        stream_type: stream,
        channel_id: channel.id,
        channel_name: channel.name,
        amount,
        memo: stream === 'adsense' ? '애드센스 월 정산' : stream === 'leading_product' ? '유료 텔레그램 리딩방 결제' : null,
        evidence_url: stream === 'adsense' ? 'https://www.google.com/adsense/' : null,
        created_by: null,
        created_at: `${month}-28T09:00:00.000Z`,
        updated_at: `${month}-28T09:00:00.000Z`
      })
    }
  })

  return rows
}

export function sampleSponsorshipInvoices(): SponsorshipInvoice[] {
  const current = getCurrentMonth()
  const rows: SponsorshipInvoice[] = []
  const rand = seeded(20260918)

  for (let i = 0; i < 14; i += 1) {
    const monthsAgo = Math.floor(rand() * 6)
    const month = shiftMonth(current, -monthsAgo)
    const day = 3 + Math.floor(rand() * 22)
    const issued = `${month}-${String(day).padStart(2, '0')}`
    const dueDate = new Date(`${issued}T00:00:00Z`)
    dueDate.setUTCDate(dueDate.getUTCDate() + 30)
    const due = dueDate.toISOString().slice(0, 10)
    const staff = SAMPLE_STAFF[Math.floor(rand() * SAMPLE_STAFF.length)]
    const amount = roundTo(1_500_000 + rand() * 6_500_000, 100_000)

    let status: SponsorshipInvoice['status']
    if (monthsAgo >= 3) status = rand() < 0.85 ? 'paid' : 'overdue'
    else if (monthsAgo >= 1) status = rand() < 0.5 ? 'paid' : rand() < 0.7 ? 'issued' : 'overdue'
    else status = rand() < 0.4 ? 'draft' : 'issued'

    const paidDate = new Date(`${issued}T00:00:00Z`)
    paidDate.setUTCDate(paidDate.getUTCDate() + 12 + Math.floor(rand() * 15))

    rows.push({
      id: `sample-inv-${i + 1}`,
      advertiser_name: ADVERTISERS[i % ADVERTISERS.length],
      campaign_name: CAMPAIGNS[Math.floor(rand() * CAMPAIGNS.length)],
      contract_amount: amount,
      staff_user_id: staff.id,
      staff_name: staff.name,
      video_url: `https://www.youtube.com/watch?v=sample${String(i + 1).padStart(3, '0')}`,
      status,
      issued_at: status === 'draft' ? null : issued,
      due_at: status === 'draft' ? null : due,
      paid_at: status === 'paid' ? paidDate.toISOString().slice(0, 10) : null,
      memo: i % 4 === 0 ? '영상 내 15초 브랜드 언급 + 고정 댓글 링크' : null,
      created_at: `${issued}T02:00:00.000Z`,
      updated_at: `${issued}T02:00:00.000Z`
    })
  }

  return rows.sort((a, b) => (b.issued_at || b.created_at).localeCompare(a.issued_at || a.created_at))
}

const EXPENSE_BASE: Record<ExpenseType, number> = {
  labor: 6_200_000,
  equipment: 450_000,
  software: 380_000,
  marketing: 900_000,
  other: 320_000
}

export function sampleExpenseEntries(): ExpenseEntry[] {
  const current = getCurrentMonth()
  const months = lastNMonths(current, 12)
  const rows: ExpenseEntry[] = []

  for (const month of months) {
    for (const type of EXPENSE_TYPES) {
      const rand = seeded(monthSeed(month, EXPENSE_BASE[type] % 89))
      if (type === 'equipment' && rand() < 0.35) continue
      const amount = roundTo(EXPENSE_BASE[type] * (0.8 + rand() * 0.4), 10_000)
      rows.push({
        id: `sample-exp-${month}-${type}`,
        month,
        expense_type: type,
        amount,
        memo:
          type === 'labor'
            ? '편집자 2명 + 사무실 관리'
            : type === 'software'
              ? 'Adobe CC, Notion, 캡컷 Pro'
              : type === 'marketing'
                ? '유튜브 광고 집행'
                : null,
        created_by: null,
        created_at: `${month}-25T09:00:00.000Z`
      })
    }
  }

  return rows
}

// 규칙 테이블이 없을 때 직원 목록(실제 crm_users)을 받아 기본 규칙을 붙인다.
export function sampleIncentiveRules(userIds: string[]): IncentiveRule[] {
  return userIds.map((userId, index) => ({
    user_id: userId,
    base_pay: index % 2 === 0 ? 500_000 : 0,
    per_video: 20_000 + (index % 3) * 5_000,
    per_1k_views: 500 + (index % 2) * 250,
    longform_weight: 1,
    shortform_weight: 0.5,
    updated_at: null
  }))
}

// 확정 정산 스냅샷 샘플(직전 3개월)
export function sampleSettlements(users: { id: string; name: string }[]): IncentiveSettlement[] {
  const current = getCurrentMonth()
  const rows: IncentiveSettlement[] = []
  users.forEach((user, userIndex) => {
    for (let back = 1; back <= 3; back += 1) {
      const month = shiftMonth(current, -back)
      const rand = seeded(monthSeed(month, userIndex + 11))
      const videoCount = 180 + Math.floor(rand() * 120)
      const totalViews = roundTo(400_000 + rand() * 900_000, 1000)
      rows.push({
        id: `sample-set-${user.id}-${month}`,
        user_id: user.id,
        month,
        video_count: videoCount,
        total_views: totalViews,
        computed_amount: roundTo(videoCount * 20_000 * 0.75 + (totalViews / 1000) * 500, 1000),
        confirmed_at: `${shiftMonth(month, 1)}-05T01:00:00.000Z`,
        confirmed_by: null
      })
    }
  })
  return rows
}
