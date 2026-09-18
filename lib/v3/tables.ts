// V3(수익화 · 정산 CRM) 전용 테이블. 메인 앱과 같은 Supabase 프로젝트를 쓰므로
// 동일하게 "youtubeCRM_" 접두어를 붙인다. DDL은 supabase/sql/v3/100_v3_revenue.sql 참고.

const PREFIX = 'youtubeCRM_'

export const V3_TABLES = {
  revenueEntries: `${PREFIX}revenue_entries`,
  sponsorshipInvoices: `${PREFIX}sponsorship_invoices`,
  incentiveRules: `${PREFIX}incentive_rules`,
  incentiveSettlements: `${PREFIX}incentive_settlements`,
  expenseEntries: `${PREFIX}expense_entries`
} as const

// 읽기 전용으로 참조하는 기존 테이블
export const SHARED_TABLES = {
  crmUsers: `${PREFIX}crm_users`,
  videos: `${PREFIX}videos`,
  channels: `${PREFIX}channels`
} as const

export const V3_SQL_FILE = 'supabase/sql/v3/100_v3_revenue.sql'
