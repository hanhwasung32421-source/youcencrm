// V2(콘텐츠 제작 파이프라인) 전용 테이블. 공유 프로젝트라 모두 youtubeCRM_ 접두어.
const PREFIX = 'youtubeCRM_'

export const V2_TABLES = {
  productionItems: `${PREFIX}production_items`,
  topicQueue: `${PREFIX}topic_queue`,
  checklistTemplates: `${PREFIX}checklist_templates`,
  productionChecklists: `${PREFIX}production_checklists`,
  staffTargets: `${PREFIX}staff_targets`
} as const

export const V2_SQL_FILE = 'supabase/sql/v2/100_v2_production.sql'

export const V2_MISSING_TABLE_MESSAGE = `V2 테이블이 아직 생성되지 않았습니다. ${V2_SQL_FILE} 을 실행해 주세요.`

export const V2_SAMPLE_BANNER_TEXT = `샘플 데이터 표시 중 — ${V2_SQL_FILE} 실행 후 실데이터로 전환됩니다`

export const DEFAULT_DAILY_TARGET = 12
