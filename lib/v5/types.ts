// V5 도메인 타입 + 한글 라벨. 서버(API)와 클라이언트(페이지)가 함께 쓴다.

export const PARTNER_TYPES = ['advertiser', 'securities', 'pr_agency', 'platform', 'other'] as const
export type PartnerType = (typeof PARTNER_TYPES)[number]
export const PARTNER_TYPE_LABEL: Record<PartnerType, string> = {
  advertiser: '광고주',
  securities: '증권사',
  pr_agency: 'PR대행사',
  platform: '플랫폼',
  other: '기타'
}

export const PARTNER_GRADES = ['A', 'B', 'C'] as const
export type PartnerGrade = (typeof PARTNER_GRADES)[number]

export const PARTNER_STATUSES = ['active', 'dormant', 'closed'] as const
export type PartnerStatus = (typeof PARTNER_STATUSES)[number]
export const PARTNER_STATUS_LABEL: Record<PartnerStatus, string> = {
  active: '활성',
  dormant: '휴면',
  closed: '종료'
}

export type Partner = {
  id: string
  company_name: string
  partner_type: PartnerType
  grade: PartnerGrade
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  tags: string[]
  status: PartnerStatus
  memo: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // 서버에서 계산해 붙이는 값(성사된 딜 금액 합계, 진행 중 딜 수)
  won_amount?: number
  open_deal_count?: number
}

export const DEAL_STAGES = ['lead', 'proposal', 'negotiation', 'contract', 'executing', 'won', 'lost'] as const
export type DealStage = (typeof DEAL_STAGES)[number]
export const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  lead: '리드',
  proposal: '제안',
  negotiation: '협상',
  contract: '계약',
  executing: '집행 중',
  won: '완료',
  lost: '실패'
}
// "진행 중"으로 치는 단계(완료/실패 제외)
export const OPEN_DEAL_STAGES: DealStage[] = ['lead', 'proposal', 'negotiation', 'contract', 'executing']
// 파이프라인 퍼널에 그리는 순서(실패는 퍼널 밖)
export const FUNNEL_STAGES: DealStage[] = ['lead', 'proposal', 'negotiation', 'contract', 'executing', 'won']

export type Deal = {
  id: string
  partner_id: string
  campaign_name: string
  stage: DealStage
  expected_amount: number
  owner_user_id: string | null
  planned_publish_on: string | null
  next_action: string | null
  next_action_on: string | null
  close_reason: string | null
  created_at: string
  updated_at: string
  partner_name?: string
  owner_name?: string | null
}

export const CONTRACT_STATUSES = ['draft', 'signed', 'executing', 'expired'] as const
export type ContractStatus = (typeof CONTRACT_STATUSES)[number]
export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: '초안',
  signed: '서명완료',
  executing: '집행중',
  expired: '만료'
}

export type Contract = {
  id: string
  partner_id: string
  deal_id: string | null
  campaign_name: string
  amount: number
  starts_on: string
  ends_on: string
  ad_disclosure: boolean
  deliverables: string | null
  status: ContractStatus
  document_url: string | null
  created_at: string
  updated_at: string
  partner_name?: string
}

export const ACTIVITY_TYPES = ['meeting', 'call', 'email', 'messenger', 'memo'] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]
export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  meeting: '미팅',
  call: '통화',
  email: '이메일',
  messenger: '메신저',
  memo: '메모'
}

export type Activity = {
  id: string
  partner_id: string | null
  deal_id: string | null
  activity_type: ActivityType
  occurred_at: string
  summary: string
  next_step: string | null
  next_step_on: string | null
  created_by: string | null
  created_at: string
  partner_name?: string | null
  deal_name?: string | null
  author_name?: string | null
}

export const COMPLIANCE_STATUSES = ['unchecked', 'passed', 'needs_fix'] as const
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number]
export const COMPLIANCE_STATUS_LABEL: Record<ComplianceStatus, string> = {
  unchecked: '미확인',
  passed: '통과',
  needs_fix: '수정필요'
}

export const COMPLIANCE_ITEMS = [
  { key: 'paid_ad_disclosed', label: '유료광고 고지' },
  { key: 'stock_disclaimer', label: '종목 언급 면책 문구' },
  { key: 'no_solicitation_notice', label: '투자 권유 아님 고지' },
  { key: 'source_cited', label: '출처 표기' },
  { key: 'thumbnail_reviewed', label: '썸네일 과장 여부 검토' }
] as const
export type ComplianceItemKey = (typeof COMPLIANCE_ITEMS)[number]['key']

export type ComplianceCheck = {
  video_id: string
  paid_ad_disclosed: boolean
  stock_disclaimer: boolean
  no_solicitation_notice: boolean
  source_cited: boolean
  thumbnail_reviewed: boolean
  status: ComplianceStatus
  reviewer_user_id: string | null
  reviewer_name?: string | null
  note: string | null
  updated_at: string | null
}

export type ComplianceVideoRow = {
  video: {
    id: string
    title: string | null
    stock_name: string
    content_type: string
    published_at: string | null
    view_count: number | null
    youtube_url: string
    owner_user_id: string
    owner_name: string | null
    created_at: string
  }
  check: ComplianceCheck
}

export const RISK_SEVERITIES = ['low', 'medium', 'high'] as const
export type RiskSeverity = (typeof RISK_SEVERITIES)[number]
export const RISK_SEVERITY_LABEL: Record<RiskSeverity, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음'
}

export const RISK_STATUSES = ['open', 'in_progress', 'resolved'] as const
export type RiskStatus = (typeof RISK_STATUSES)[number]
export const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  open: '열림',
  in_progress: '조치 중',
  resolved: '해결'
}

export type RiskIssue = {
  id: string
  title: string
  video_id: string | null
  partner_id: string | null
  severity: RiskSeverity
  status: RiskStatus
  action_note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  video_title?: string | null
  partner_name?: string | null
  author_name?: string | null
}

export type StaffUser = {
  id: string
  name: string
  role_type: string
}

export type UpcomingEvent = {
  kind: 'contract_end' | 'publish' | 'next_action' | 'next_step'
  label: string
  date: string
  title: string
  subtitle: string
  href: string
}

export type DashboardData = {
  sample?: boolean
  kpis: {
    activePartners: number
    openDeals: number
    monthExpectedAmount: number
    expiringContracts30d: number
    complianceIncomplete: number
  }
  funnel: Array<{ stage: DealStage; count: number; amount: number }>
  lostCount: number
  upcoming: UpcomingEvent[]
  recentActivities: Activity[]
  gradeDistribution: Array<{ grade: PartnerGrade; count: number }>
}
