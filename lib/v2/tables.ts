// V2(SEO·발견성 최적화) 전용 테이블. 공유 프로젝트라 모두 youtubeCRM_ 접두어.
const PREFIX = 'youtubeCRM_'

export const V2_TABLES = {
  seoChecklists: `${PREFIX}seo_checklists`,
  thumbnailReviews: `${PREFIX}thumbnail_reviews`,
  keywordRadar: `${PREFIX}keyword_radar`,
  plannedSlots: `${PREFIX}planned_slots`
} as const

export const V2_SQL_FILE = 'supabase/sql/v2/100_v2_seo.sql'

export const V2_MISSING_TABLE_MESSAGE = `V2 테이블이 아직 생성되지 않았습니다. ${V2_SQL_FILE} 을 실행해 주세요.`

export const V2_SAMPLE_BANNER_TEXT = `샘플 데이터 표시 중 — ${V2_SQL_FILE} 실행 후 실데이터로 전환됩니다`
