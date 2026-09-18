// SQL(supabase/sql/v2/100_v2_production.sql)을 아직 실행하지 않았을 때 API가 돌려주는 샘플.
// 화면 구성과 흐름을 미리 볼 수 있도록 실제 운영과 비슷한 종목/직원/시각으로 채운다.
import { DEFAULT_DAILY_TARGET } from './tables'
import { addDays, kstYmd, lastNDays } from './dates'
import type {
  BoardPayload,
  ChecklistRow,
  ChecklistTemplate,
  ContentType,
  ItemsPayload,
  Priority,
  ProductionItem,
  RecentStock,
  StaffLite,
  StaffTargetsPayload,
  Stage,
  TemplatesPayload,
  TopicItem,
  TopicsPayload,
  WorkloadPayload,
  WorkloadRow
} from './types'

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export const SAMPLE_STAFF: StaffLite[] = [
  { id: uid(1), name: '김민준', roleType: 'staff' },
  { id: uid(2), name: '이서연', roleType: 'senior_staff' },
  { id: uid(3), name: '박지훈', roleType: 'staff' },
  { id: uid(4), name: '최수아', roleType: 'assistant_manager' },
  { id: uid(5), name: '정도윤', roleType: 'staff' },
  { id: uid(6), name: '강하은', roleType: 'manager' }
]

export const SAMPLE_TARGETS: Record<string, number> = {
  [uid(1)]: 12,
  [uid(2)]: 12,
  [uid(3)]: 15,
  [uid(4)]: 12,
  [uid(5)]: 10,
  [uid(6)]: 12
}

export const SAMPLE_DONE_TODAY: Record<string, number> = {
  [uid(1)]: 7,
  [uid(2)]: 11,
  [uid(3)]: 9,
  [uid(4)]: 4,
  [uid(5)]: 10,
  [uid(6)]: 6
}

function at(ymd: string, hh: number, mm = 0): string {
  return new Date(`${ymd}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+09:00`).toISOString()
}

type Seed = [
  n: number,
  stock: string,
  issue: string,
  staffIndex: number,
  type: ContentType,
  stage: Stage,
  priority: Priority,
  dayOffset: number,
  hour: number,
  note?: string
]

const ITEM_SEEDS: Seed[] = [
  [101, '삼성전자', 'HBM4 양산 일정 앞당김 보도 — 외국인 수급 점검', 0, 'longform', 'planning', 'high', 0, 14, '차트 3분봉 캡처 준비'],
  [102, 'SK하이닉스', '엔비디아 실적 발표 후 시간외 급등', 1, 'shortform', 'planning', 'urgent', 0, 11],
  [103, '에코프로', '2차전지 리튬 가격 반등 — 반등 신호인가', 2, 'longform', 'planning', 'normal', 0, 16],
  [104, 'LS머트리얼즈', '전력기기 테마 재점화, 거래량 급증', 3, 'shortform', 'planning', 'low', 1, 10],
  [105, '현대차', '미국 관세 협상 결과와 자동차주 반응', 0, 'longform', 'shooting', 'high', 0, 13, '프롬프터 원고 확정'],
  [106, '한미반도체', 'TC본더 수주 공시 해설', 4, 'longform', 'shooting', 'normal', 0, 15],
  [107, '두산에너빌리티', '원전 수주 기대감 — 체크포인트 3가지', 5, 'shortform', 'shooting', 'normal', 0, 12],
  [108, 'POSCO홀딩스', '철강 감산 발표, 저점 매수 논쟁', 1, 'longform', 'editing', 'normal', 0, 10, '자막 교정 중'],
  [109, '카카오', '카카오톡 개편 이후 광고 매출 전망', 2, 'shortform', 'editing', 'low', 0, 17],
  [110, '알테오젠', '기술수출 마일스톤 수령 공시', 3, 'longform', 'editing', 'high', 0, 9],
  [111, 'NAVER', 'AI 검색 개편 발표 — 단기 모멘텀 점검', 4, 'shortform', 'ready', 'normal', 0, 8, '썸네일 A/B 2안'],
  [112, '삼성SDI', '전고체 배터리 로드맵 업데이트', 5, 'longform', 'ready', 'urgent', 0, 7],
  [113, 'LG에너지솔루션', '북미 ESS 공장 가동 소식', 0, 'shortform', 'ready', 'normal', 0, 18],
  [114, '셀트리온', '짐펜트라 처방 데이터 공개', 1, 'longform', 'done', 'normal', 0, 9],
  [115, '기아', '월간 판매 실적 발표 요약', 2, 'shortform', 'done', 'low', 0, 8],
  [116, 'HD현대일렉트릭', '변압기 수주 잔고 사상 최대', 3, 'longform', 'done', 'high', 0, 10],
  [117, '삼성전자', '주주환원 정책 발표 — 자사주 소각 규모', 4, 'longform', 'planning', 'normal', 2, 14],
  [118, 'SK하이닉스', '분기 실적 프리뷰', 5, 'longform', 'planning', 'high', 3, 11],
  [119, '에코프로', '광물 가격 추이 주간 점검', 0, 'shortform', 'planning', 'low', 5, 16],
  [120, '한미반도체', '경쟁사 진입 우려 — 팩트 체크', 1, 'longform', 'planning', 'normal', -1, 15]
]

const SAMPLE_CHECKLIST_COUNT: Record<ContentType, number> = { longform: 7, shortform: 5 }

export function sampleProductionItems(now = new Date()): ProductionItem[] {
  const today = kstYmd(now)
  return ITEM_SEEDS.map(([n, stock, issue, staffIndex, type, stage, priority, dayOffset, hour, note]) => {
    const staff = SAMPLE_STAFF[staffIndex]
    const due = at(addDays(today, dayOffset), hour)
    const total = SAMPLE_CHECKLIST_COUNT[type]
    const stageIndex = ['planning', 'shooting', 'editing', 'ready', 'done'].indexOf(stage)
    const done = Math.min(total, Math.round((total * stageIndex) / 4))
    return {
      id: uid(n),
      stock_name: stock,
      issue_summary: issue,
      assignee_user_id: staff.id,
      assignee_name: staff.name,
      content_type: type,
      stage,
      priority,
      due_at: due,
      note: note || null,
      video_id: stage === 'done' ? uid(900 + n) : null,
      topic_id: null,
      created_by: uid(99),
      created_at: at(addDays(today, -1), 18),
      updated_at: stage === 'done' ? at(today, hour) : at(today, 8, 30),
      checklist_done: done,
      checklist_total: total
    }
  })
}

// 직원 계정으로 샘플을 볼 때는 첫 번째 샘플 직원의 아이템을 "내 것"으로 바꿔 보여준다.
export function sampleBoardFor(profile: { id: string; name: string }, isAdmin: boolean): BoardPayload {
  const today = kstYmd()
  const all = sampleProductionItems()
  if (isAdmin) {
    return { items: all, staff: SAMPLE_STAFF, targets: SAMPLE_TARGETS, doneToday: SAMPLE_DONE_TODAY, today, sample: true }
  }
  const mine = all
    .filter((item) => item.assignee_user_id === SAMPLE_STAFF[0].id)
    .map((item) => ({ ...item, assignee_user_id: profile.id, assignee_name: profile.name }))
  return {
    items: mine,
    staff: [{ id: profile.id, name: profile.name }],
    targets: { [profile.id]: SAMPLE_TARGETS[SAMPLE_STAFF[0].id] },
    doneToday: { [profile.id]: SAMPLE_DONE_TODAY[SAMPLE_STAFF[0].id] },
    today,
    sample: true
  }
}

export function sampleItemsFor(
  profile: { id: string; name: string },
  isAdmin: boolean,
  range?: { from?: string | null; to?: string | null; assignee?: string | null }
): ItemsPayload {
  const base = sampleBoardFor(profile, isAdmin)
  let items = base.items
  if (range?.from) items = items.filter((item) => item.due_at && item.due_at >= range.from!)
  if (range?.to) items = items.filter((item) => item.due_at && item.due_at < range.to!)
  if (range?.assignee) items = items.filter((item) => item.assignee_user_id === range.assignee)
  return { items, staff: base.staff, sample: true }
}

export function sampleTopics(now = new Date()): TopicItem[] {
  const today = kstYmd(now)
  const rows: [number, string, string, string | null, Priority, TopicItem['status'], number | null, number, number][] = [
    [201, '삼성전자', 'HBM4 양산 일정 관련 외신 보도 — 외국인 순매수 전환 여부', 'https://news.example.com/samsung-hbm4', 'high', 'waiting', null, 0, 7],
    [202, '에코프로', '리튬 현물 가격 3주 연속 반등', 'https://news.example.com/lithium', 'normal', 'waiting', null, 0, 8],
    [203, 'LS머트리얼즈', '데이터센터 전력기기 수요 급증 리포트', null, 'normal', 'waiting', null, 0, 9],
    [204, '한미반도체', 'TC본더 신규 수주 공시', 'https://dart.fss.or.kr', 'urgent', 'assigned', 4, 0, 6],
    [205, '현대차', '관세 협상 타결 시나리오별 밸류에이션', null, 'high', 'assigned', 0, -1, 17],
    [206, 'SK하이닉스', '엔비디아 실적 발표 직후 시간외 흐름', 'https://news.example.com/nvda', 'urgent', 'produced', 1, -1, 22],
    [207, '두산에너빌리티', '체코 원전 본계약 일정', null, 'normal', 'produced', 5, -2, 10],
    [208, '알테오젠', '경쟁 약물 임상 결과 — 리스크 점검', null, 'low', 'waiting', null, -2, 14]
  ]
  return rows.map(([n, stock, issue, url, urgency, status, staffIndex, dayOffset, hour]) => ({
    id: uid(n),
    stock_name: stock,
    issue_summary: issue,
    source_url: url,
    urgency,
    status,
    assigned_to: staffIndex === null ? null : SAMPLE_STAFF[staffIndex].id,
    assigned_name: staffIndex === null ? null : SAMPLE_STAFF[staffIndex].name,
    created_by: uid(99),
    created_by_name: '운영자',
    created_at: at(addDays(today, dayOffset), hour)
  }))
}

export function sampleRecentStocks(now = new Date()): RecentStock[] {
  const today = kstYmd(now)
  return [
    { stock_name: '삼성전자', count: 5, last_at: at(today, 9) },
    { stock_name: 'SK하이닉스', count: 4, last_at: at(today, 8) },
    { stock_name: '현대차', count: 3, last_at: at(addDays(today, -1), 15) },
    { stock_name: '에코프로', count: 3, last_at: at(addDays(today, -1), 11) },
    { stock_name: '한미반도체', count: 2, last_at: at(addDays(today, -2), 16) },
    { stock_name: '셀트리온', count: 2, last_at: at(today, 9) },
    { stock_name: '기아', count: 1, last_at: at(today, 8) },
    { stock_name: 'HD현대일렉트릭', count: 1, last_at: at(today, 10) },
    { stock_name: 'POSCO홀딩스', count: 1, last_at: at(addDays(today, -3), 13) },
    { stock_name: '두산에너빌리티', count: 2, last_at: at(addDays(today, -4), 12) }
  ]
}

export function sampleTopicsPayload(): TopicsPayload {
  return { items: sampleTopics(), recentStocks: sampleRecentStocks(), staff: SAMPLE_STAFF, sample: true }
}

export const SAMPLE_TEMPLATES: ChecklistTemplate[] = [
  {
    id: uid(301),
    name: '롱폼 표준',
    content_type: 'longform',
    items: ['썸네일 확인 (종목명·수치 가독성)', '종목 고지 문구 삽입', '면책 문구(투자 판단 책임) 삽입', '태그 10개 이상 입력', '설명란 링크·타임스탬프 정리', '제목에 종목명 포함', '엔딩 구독 유도 삽입'],
    is_default: true,
    created_at: '2026-01-05T00:00:00.000Z'
  },
  {
    id: uid(302),
    name: '숏폼 표준',
    content_type: 'shortform',
    items: ['세로 9:16 확인', '첫 3초 훅(종목·수치) 확인', '종목 고지 문구 삽입', '면책 문구 삽입', '해시태그 #shorts 포함'],
    is_default: true,
    created_at: '2026-01-05T00:00:00.000Z'
  },
  {
    id: uid(303),
    name: '긴급 이슈 속보',
    content_type: null,
    items: ['출처 URL 확인', '수치·날짜 교차 검증', '면책 문구 삽입', '썸네일 속보 표기'],
    is_default: false,
    created_at: '2026-02-11T00:00:00.000Z'
  }
]

export function sampleTemplatesPayload(): TemplatesPayload {
  return { items: SAMPLE_TEMPLATES, sample: true }
}

export function sampleChecklistFor(item: { content_type: ContentType; stage: Stage } | null): { items: ChecklistRow[]; templateName: string | null } {
  const type: ContentType = item?.content_type || 'longform'
  const template = SAMPLE_TEMPLATES.find((t) => t.content_type === type) || SAMPLE_TEMPLATES[0]
  const stageIndex = item ? ['planning', 'shooting', 'editing', 'ready', 'done'].indexOf(item.stage) : 0
  const done = Math.min(template.items.length, Math.round((template.items.length * stageIndex) / 4))
  return {
    templateName: template.name,
    items: template.items.map((label, index) => ({ item_index: index, label, checked: index < done }))
  }
}

export function sampleWorkload(now = new Date()): WorkloadPayload {
  const today = kstYmd(now)
  const days = lastNDays(7, today)
  const sparkSeeds: number[][] = [
    [11, 12, 10, 13, 12, 9, 7],
    [12, 12, 13, 12, 14, 11, 11],
    [14, 15, 13, 15, 12, 15, 9],
    [10, 11, 12, 9, 8, 12, 4],
    [9, 10, 10, 11, 10, 10, 10],
    [12, 10, 11, 12, 13, 12, 6]
  ]
  const items = sampleProductionItems(now)
  const rows: WorkloadRow[] = SAMPLE_STAFF.map((staff, index) => {
    const mine = items.filter((item) => item.assignee_user_id === staff.id)
    const nowMs = now.getTime()
    return {
      userId: staff.id,
      name: staff.name,
      target: SAMPLE_TARGETS[staff.id] ?? DEFAULT_DAILY_TARGET,
      doneToday: SAMPLE_DONE_TODAY[staff.id] ?? 0,
      inProgress: mine.filter((item) => ['shooting', 'editing', 'ready'].includes(item.stage)).length,
      late: mine.filter((item) => item.stage !== 'done' && item.due_at && new Date(item.due_at).getTime() < nowMs).length,
      planning: mine.filter((item) => item.stage === 'planning').length,
      attendance:
        index === 3
          ? { check_in_at: at(today, 9, 42), check_out_at: null, attendance_status: 'late' }
          : index === 5
            ? null
            : { check_in_at: at(today, 8, 50 + index), check_out_at: null, attendance_status: 'present' },
      spark: days.map((date, i) => ({ date, count: sparkSeeds[index][i] }))
    }
  })
  return { rows, today, days, sample: true }
}

export function sampleStaffTargets(): StaffTargetsPayload {
  return {
    items: SAMPLE_STAFF.map((staff) => ({ userId: staff.id, name: staff.name, dailyTarget: SAMPLE_TARGETS[staff.id] ?? DEFAULT_DAILY_TARGET })),
    sample: true
  }
}
