// V3(시청자 참여 · 커뮤니티 성장 CRM) 전용 테이블. 메인 앱과 같은 Supabase 프로젝트를 쓰므로
// 동일하게 "youtubeCRM_" 접두어를 붙인다. DDL은 supabase/sql/v3/100_v3_engagement.sql 참고.

const PREFIX = 'youtubeCRM_'

export const V3_TABLES = {
  viralSignalAcks: `${PREFIX}viral_signal_acks`,
  videoSeries: `${PREFIX}video_series`,
  videoSeriesMembers: `${PREFIX}video_series_members`
} as const

// 읽기(+제한적 쓰기) 전용으로 참조하는 기존 테이블
export const SHARED_TABLES = {
  crmUsers: `${PREFIX}crm_users`,
  videos: `${PREFIX}videos`,
  videoSnapshots: `${PREFIX}video_snapshots`,
  youtubeAccounts: `${PREFIX}youtube_accounts`
} as const

export const V3_SQL_FILE = 'supabase/sql/v3/100_v3_engagement.sql'
