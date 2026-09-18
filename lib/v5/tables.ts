// V5(파트너 · 협찬 딜 · 컴플라이언스) 전용 테이블. 메인 앱과 같은 Supabase
// 프로젝트를 쓰므로 모두 youtubeCRM_ 접두어를 붙인다. DDL은
// supabase/sql/v5/100_v5_partners.sql 참고.

const PREFIX = 'youtubeCRM_'

export const V5_TABLES = {
  partners: `${PREFIX}partners`,
  deals: `${PREFIX}deals`,
  contracts: `${PREFIX}contracts`,
  activities: `${PREFIX}partner_activities`,
  complianceChecks: `${PREFIX}compliance_checks`,
  riskIssues: `${PREFIX}risk_issues`,
  // 읽기 전용으로 참조하는 기존 테이블
  crmUsers: `${PREFIX}crm_users`,
  videos: `${PREFIX}videos`
} as const

export const V5_SQL_FILE = 'supabase/sql/v5/100_v5_partners.sql'
export const V5_MISSING_TABLE_MESSAGE = `V5 테이블이 아직 생성되지 않았습니다. ${V5_SQL_FILE} 을 실행해 주세요.`
