// V5 테이블이 아직 없을 때(SQL 미실행) GET 응답에 내려주는 샘플 데이터.
// 날짜는 "오늘" 기준 상대값으로 만들어서 캔버스/플레이북/회고 위젯이 항상 살아 있게 한다.
// 영상 등록/스코어보드는 실데이터(youtubeCRM_videos)를 바로 읽으므로 여기서는 다루지 않는다.

import { addDays, todayYmd } from '@/lib/v5/format'
import type { GrowthExperiment, PlaybookEntry, StaffUser, WeeklyRetro } from '@/lib/v5/types'

const TODAY = todayYmd()
const d = (offset: number) => addDays(TODAY, offset)
const ts = (offset: number, hour = 10) => `${d(offset)}T${String(hour).padStart(2, '0')}:00:00+09:00`

export const SAMPLE_STAFF: StaffUser[] = [
  { id: 'sample-user-1', name: '김서연', role_type: 'staff' },
  { id: 'sample-user-2', name: '박준혁', role_type: 'senior_staff' },
  { id: 'sample-user-3', name: '이도윤', role_type: 'staff' },
  { id: 'sample-user-4', name: '최하늘', role_type: 'manager' },
  { id: 'sample-user-5', name: '정민재', role_type: 'staff' },
  { id: 'sample-user-6', name: '한지우', role_type: 'staff' }
]

const staffName = (id: string | null) => SAMPLE_STAFF.find((s) => s.id === id)?.name || null

// 실제 videos 테이블 없이도 실험/플레이북 카드에 "대상 영상" 표시가 되도록 하는 가짜 영상 참조.
// id는 sample- 접두어라 실제 youtubeCRM_videos.id와 절대 충돌하지 않는다.
export const SAMPLE_VIDEO_REFS: Array<{ id: string; title: string; stock_name: string }> = [
  { id: 'sample-video-1', title: '삼성전자 4분기 실적 발표, 지금 사도 될까?', stock_name: '삼성전자' },
  { id: 'sample-video-2', title: 'SK하이닉스 HBM 슈퍼사이클 총정리', stock_name: 'SK하이닉스' },
  { id: 'sample-video-3', title: '에코프로 급등 이유 3가지', stock_name: '에코프로' },
  { id: 'sample-video-4', title: '현대차 전기차 전략, 숫자로 보는 미래', stock_name: '현대차' },
  { id: 'sample-video-5', title: 'LS머트리얼즈 상한가 뒤에 숨은 진짜 이유', stock_name: 'LS머트리얼즈' },
  { id: 'sample-video-6', title: '한미반도체 목표주가 상향, 증권사 리포트 분석', stock_name: '한미반도체' },
  { id: 'sample-video-7', title: '알테오젠 신약 파이프라인 완전정리 (숏폼)', stock_name: '알테오젠' }
]
const videoTitle = (id: string | null) => SAMPLE_VIDEO_REFS.find((v) => v.id === id)?.title || null

// ---------------------------------------------------------------------------
// 2) 성장 실험 캔버스
// ---------------------------------------------------------------------------
const rawExperiments: Array<Omit<GrowthExperiment, 'author_name' | 'videos'>> = [
  {
    id: 'sample-exp-1',
    dimensions: ['thumbnail', 'title'],
    video_ids: ['sample-video-1'],
    hypothesis: '썸네일에 큰 숫자(퍼센트)와 화살표를 넣으면 클릭률이 오를 것이다.',
    metric_definition: '업로드 후 48시간 CTR(노출 대비 클릭률), 유튜브 스튜디오 기준',
    started_on: d(-6),
    ended_on: null,
    status: 'running',
    effect_size: null,
    next_action: '72시간 시점에 CTR 재확인 후 승/패 판단',
    created_by: 'sample-user-1',
    created_at: ts(-6),
    updated_at: ts(-1)
  },
  {
    id: 'sample-exp-2',
    dimensions: ['publish_time'],
    video_ids: ['sample-video-2', 'sample-video-6'],
    hypothesis: '오전 7시 발행이 저녁 8시 발행보다 초기 24시간 조회수가 높을 것이다.',
    metric_definition: '발행 후 24시간 누적 조회수',
    started_on: d(-14),
    ended_on: d(-3),
    status: 'won',
    effect_size: 32,
    next_action: '반도체 관련 영상은 오전 7시 고정 발행으로 전환',
    created_by: 'sample-user-2',
    created_at: ts(-14),
    updated_at: ts(-3)
  },
  {
    id: 'sample-exp-3',
    dimensions: ['format', 'length'],
    video_ids: ['sample-video-7'],
    hypothesis: '롱폼을 3분 숏폼으로 재편집하면 완주율이 오를 것이다.',
    metric_definition: '평균 조회 지속시간 비율(%)',
    started_on: d(-20),
    ended_on: d(-9),
    status: 'lost',
    effect_size: -8,
    next_action: '완주율 개선은 형식 변경보다 도입부 훅 수정으로 재시도',
    created_by: 'sample-user-6',
    created_at: ts(-20),
    updated_at: ts(-9)
  },
  {
    id: 'sample-exp-4',
    dimensions: ['title'],
    video_ids: ['sample-video-3'],
    hypothesis: '제목에 종목명을 앞에 두면 검색 유입이 늘 것이다.',
    metric_definition: '유튜브 검색 트래픽 비중(%)',
    started_on: d(-2),
    ended_on: null,
    status: 'paused',
    effect_size: null,
    next_action: '에코프로 이슈 소강 후 재개',
    created_by: 'sample-user-3',
    created_at: ts(-2),
    updated_at: ts(-1)
  },
  {
    id: 'sample-exp-5',
    dimensions: ['thumbnail', 'publish_time', 'format'],
    video_ids: ['sample-video-4', 'sample-video-5'],
    hypothesis: '금요일 오후 발행 + 인물 리액션 썸네일 조합이 주말 알고리즘 노출에 유리할 것이다.',
    metric_definition: '업로드 후 7일 누적 조회수 대비 추천 유입 비율',
    started_on: d(-1),
    ended_on: null,
    status: 'running',
    effect_size: null,
    next_action: '이번 주 금요일 발행분으로 1차 검증',
    created_by: 'sample-user-4',
    created_at: ts(-1),
    updated_at: ts(0)
  }
]

export const SAMPLE_EXPERIMENTS: GrowthExperiment[] = rawExperiments.map((e) => ({
  ...e,
  author_name: staffName(e.created_by),
  videos: (e.video_ids || []).map((id) => ({ id, title: videoTitle(id), stock_name: SAMPLE_VIDEO_REFS.find((v) => v.id === id)?.stock_name || '' }))
}))

// ---------------------------------------------------------------------------
// 4) 발행 전략 플레이북
// ---------------------------------------------------------------------------
const rawPlaybook: Array<Omit<PlaybookEntry, 'author_name' | 'example_video_title'>> = [
  {
    id: 'sample-pb-1',
    title: '실적 발표 당일 "숫자 먼저" 훅',
    when_to_use: '분기 실적 발표 당일, 컨센서스 대비 서프라이즈가 있을 때',
    example_video_id: 'sample-video-1',
    tags: ['실적', '숏폼가능', '고CTR'],
    effect_note: '평균 조회수 대비 +40% 이상, 당일 발행 시 효과 최대',
    usage_count: 14,
    created_by: 'sample-user-2',
    created_at: ts(-90)
  },
  {
    id: 'sample-pb-2',
    title: '섹터 슈퍼사이클 시리즈물',
    when_to_use: 'HBM/2차전지 등 테마가 3일 이상 뉴스에 나올 때, 3~5편 연속 기획',
    example_video_id: 'sample-video-2',
    tags: ['시리즈', '반도체', '구독전환'],
    effect_note: '시리즈 2편부터 구독 전환율 상승',
    usage_count: 9,
    created_by: 'sample-user-4',
    created_at: ts(-70)
  },
  {
    id: 'sample-pb-3',
    title: '급등주 "이유 3가지" 포맷',
    when_to_use: '상한가/급등 종목 발생 당일, 원인 분석형',
    example_video_id: 'sample-video-3',
    tags: ['급등주', '당일발행', '숏폼'],
    effect_note: '초기 3시간 조회 속도가 평균 대비 2배 이상',
    usage_count: 21,
    created_by: 'sample-user-1',
    created_at: ts(-120)
  },
  {
    id: 'sample-pb-4',
    title: '증권사 리포트 팩트체크',
    when_to_use: '목표주가 상향/하향 리포트가 나왔을 때, 신뢰도 강조형',
    example_video_id: 'sample-video-6',
    tags: ['리포트', '신뢰도'],
    effect_note: '댓글 참여율(참여도)이 평균보다 높음',
    usage_count: 6,
    created_by: 'sample-user-5',
    created_at: ts(-45)
  },
  {
    id: 'sample-pb-5',
    title: '신약/파이프라인 초심자용 숏폼 요약',
    when_to_use: '바이오 종목 임상 결과 발표 전후, 초심자 대상',
    example_video_id: 'sample-video-7',
    tags: ['바이오', '숏폼', '초심자'],
    effect_note: '숏폼 완주율 높음, 롱폼 전환 유입원으로 활용',
    usage_count: 3,
    created_by: 'sample-user-6',
    created_at: ts(-15)
  }
]

export const SAMPLE_PLAYBOOK: PlaybookEntry[] = rawPlaybook
  .sort((a, b) => b.usage_count - a.usage_count)
  .map((p) => ({ ...p, author_name: staffName(p.created_by), example_video_title: videoTitle(p.example_video_id) }))

// ---------------------------------------------------------------------------
// 5) 성장 회고 노트
// ---------------------------------------------------------------------------
export const SAMPLE_RETROS: WeeklyRetro[] = [
  {
    id: 'sample-retro-1',
    week_label: '2026-W36',
    went_well: '반도체 테마 시리즈물이 평균 대비 조회수 1.6배. 오전 7시 발행 실험이 승리로 종료.',
    to_improve: '숏폼 완주율이 여전히 낮음. 도입부 3초 훅이 약함.',
    action_items: [
      { text: '숏폼 도입부 훅 가이드 작성', done: true },
      { text: '오전 7시 발행을 반도체 담당자 전원 표준으로 전환', done: true },
      { text: '바이오 종목 플레이북 초안 작성', done: false }
    ],
    kpi_snapshot: { totalViews: 4_820_000, totalVideos: 96, avgViewsPerVideo: 50_208 },
    created_by: 'sample-user-4',
    created_at: ts(-14, 18)
  },
  {
    id: 'sample-retro-2',
    week_label: '2026-W37',
    went_well: '급등주 "이유 3가지" 포맷 재사용 21회 돌파, 안정적인 조회수 확보 채널로 자리잡음.',
    to_improve: '썸네일 A/B 실험이 3건 중 2건 무승부로 종료됨. 가설이 너무 약함.',
    action_items: [
      { text: '썸네일 실험 가설을 "요소 1개만 변경"으로 좁히기', done: true },
      { text: '알고리즘 친화도 하위 20% 영상 원인 분석', done: false },
      { text: '플레이북 사용 횟수 상위 3개 팀 공유', done: false }
    ],
    kpi_snapshot: { totalViews: 5_110_000, totalVideos: 101, avgViewsPerVideo: 50_594 },
    created_by: 'sample-user-4',
    created_at: ts(-7, 18)
  }
]
