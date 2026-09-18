// V2 제작 파이프라인 공용 타입/상수. 서버(API)와 클라이언트(페이지)가 함께 쓴다.

export const STAGES = ['planning', 'shooting', 'editing', 'ready', 'done'] as const
export type Stage = (typeof STAGES)[number]
export const STAGE_LABELS: Record<Stage, string> = {
  planning: '기획',
  shooting: '촬영/녹화',
  editing: '편집',
  ready: '업로드 대기',
  done: '완료'
}

export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export type Priority = (typeof PRIORITIES)[number]
export const PRIORITY_LABELS: Record<Priority, string> = {
  low: '낮음',
  normal: '보통',
  high: '높음',
  urgent: '긴급'
}

export const CONTENT_TYPES = ['longform', 'shortform'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  longform: '롱폼',
  shortform: '숏폼'
}

export const TOPIC_STATUSES = ['waiting', 'assigned', 'produced'] as const
export type TopicStatus = (typeof TOPIC_STATUSES)[number]
export const TOPIC_STATUS_LABELS: Record<TopicStatus, string> = {
  waiting: '대기',
  assigned: '배정됨',
  produced: '제작됨'
}

export type StaffLite = {
  id: string
  name: string
  roleType?: string
}

export type ProductionItem = {
  id: string
  stock_name: string
  issue_summary: string | null
  assignee_user_id: string | null
  assignee_name: string | null
  content_type: ContentType
  stage: Stage
  priority: Priority
  due_at: string | null
  note: string | null
  video_id: string | null
  topic_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  checklist_done?: number
  checklist_total?: number
}

export type TopicItem = {
  id: string
  stock_name: string
  issue_summary: string | null
  source_url: string | null
  urgency: Priority
  status: TopicStatus
  assigned_to: string | null
  assigned_name: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
}

export type RecentStock = {
  stock_name: string
  count: number
  last_at: string
}

export type ChecklistTemplate = {
  id: string
  name: string
  content_type: ContentType | null
  items: string[]
  is_default: boolean
  created_at: string
}

export type ChecklistRow = {
  item_index: number
  label: string
  checked: boolean
}

export type AttendanceLite = {
  check_in_at: string | null
  check_out_at: string | null
  attendance_status: string | null
}

export type WorkloadRow = {
  userId: string
  name: string
  target: number
  doneToday: number
  inProgress: number
  late: number
  planning: number
  attendance: AttendanceLite | null
  spark: { date: string; count: number }[]
}

export type BoardPayload = {
  items: ProductionItem[]
  staff: StaffLite[]
  targets: Record<string, number>
  doneToday: Record<string, number>
  today: string
  sample?: boolean
  error?: string
}

export type ItemsPayload = {
  items: ProductionItem[]
  staff: StaffLite[]
  sample?: boolean
  error?: string
}

export type TopicsPayload = {
  items: TopicItem[]
  recentStocks: RecentStock[]
  staff: StaffLite[]
  sample?: boolean
  error?: string
}

export type WorkloadPayload = {
  rows: WorkloadRow[]
  today: string
  days: string[]
  sample?: boolean
  error?: string
}

export type TemplatesPayload = {
  items: ChecklistTemplate[]
  sample?: boolean
  error?: string
}

export type ChecklistPayload = {
  items: ChecklistRow[]
  templateName: string | null
  sample?: boolean
  error?: string
}

export type StaffTargetsPayload = {
  items: { userId: string; name: string; dailyTarget: number }[]
  sample?: boolean
  error?: string
}

export function isLateItem(item: Pick<ProductionItem, 'stage' | 'due_at'>, now = Date.now()) {
  if (item.stage === 'done' || !item.due_at) return false
  const due = new Date(item.due_at).getTime()
  return Number.isFinite(due) && due < now
}

export function isInProgressStage(stage: Stage) {
  return stage === 'shooting' || stage === 'editing' || stage === 'ready'
}
