// V5 테이블이 아직 없을 때(SQL 미실행) GET 응답에 내려주는 샘플 데이터.
// 날짜는 "오늘" 기준 상대값으로 만들어서 만료 임박/다가오는 일정 위젯이 항상 살아 있게 한다.

import { addDays, todayYmd } from '@/lib/v5/format'
import type { Activity, Contract, Deal, Partner, RiskIssue, StaffUser } from '@/lib/v5/types'

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

export const SAMPLE_PARTNERS: Partner[] = [
  {
    id: 'sample-partner-1',
    company_name: '키움증권',
    partner_type: 'securities',
    grade: 'A',
    contact_name: '오세훈 팀장',
    contact_email: 'sh.oh@kiwoom.example',
    contact_phone: '02-3787-5000',
    tags: ['MTS', '이벤트 협찬', '분기 계약'],
    status: 'active',
    memo: '영웅문S# 신규 계좌 이벤트 위주. 분기 단위로 롱폼 4편 + 숏폼 8편 패키지 선호.',
    created_by: null,
    created_at: ts(-180),
    updated_at: ts(-3)
  },
  {
    id: 'sample-partner-2',
    company_name: '미래에셋증권',
    partner_type: 'securities',
    grade: 'A',
    contact_name: '한소희 매니저',
    contact_email: 'sh.han@miraeasset.example',
    contact_phone: '02-3774-1700',
    tags: ['ETF', '연금', '브랜디드'],
    status: 'active',
    memo: 'TIGER ETF 브랜디드 콘텐츠. 종목 언급 시 면책 문구 필수 요청.',
    created_by: null,
    created_at: ts(-150),
    updated_at: ts(-7)
  },
  {
    id: 'sample-partner-3',
    company_name: '토스증권',
    partner_type: 'securities',
    grade: 'B',
    contact_name: '김태양',
    contact_email: 'sun.kim@tossinvest.example',
    contact_phone: '1599-7987',
    tags: ['해외주식', '앱 설치', 'CPA'],
    status: 'active',
    memo: '앱 설치 성과형 제안 있음. 숏폼 위주.',
    created_by: null,
    created_at: ts(-120),
    updated_at: ts(-12)
  },
  {
    id: 'sample-partner-4',
    company_name: '삼성증권',
    partner_type: 'securities',
    grade: 'B',
    contact_name: '이정민 과장',
    contact_email: 'jm.lee@samsungpop.example',
    contact_phone: '02-2020-8000',
    tags: ['리서치', '세미나'],
    status: 'active',
    memo: '리서치센터 연계 세미나 중계 협의 중.',
    created_by: null,
    created_at: ts(-95),
    updated_at: ts(-20)
  },
  {
    id: 'sample-partner-5',
    company_name: '한국경제TV',
    partner_type: 'platform',
    grade: 'B',
    contact_name: '박영호 PD',
    contact_email: 'yh.park@wowtv.example',
    contact_phone: '02-6676-0000',
    tags: ['출연', '공동제작'],
    status: 'active',
    memo: '주간 출연 코너 공동제작. 광고 아님(콘텐츠 제휴).',
    created_by: null,
    created_at: ts(-200),
    updated_at: ts(-30)
  },
  {
    id: 'sample-partner-6',
    company_name: '네이버 증권 PR팀',
    partner_type: 'pr_agency',
    grade: 'C',
    contact_name: '정유진',
    contact_email: 'yj.jung@navercorp.example',
    contact_phone: '1588-3820',
    tags: ['보도자료', '기능 소개'],
    status: 'dormant',
    memo: '신규 기능 소개 영상 1회 진행 후 휴면.',
    created_by: null,
    created_at: ts(-260),
    updated_at: ts(-90)
  },
  {
    id: 'sample-partner-7',
    company_name: '인베스팅닷컴 코리아',
    partner_type: 'advertiser',
    grade: 'C',
    contact_name: '문성준',
    contact_email: 'sj.moon@investing.example',
    contact_phone: '02-555-0192',
    tags: ['프로 구독', '배너'],
    status: 'closed',
    memo: '2회 진행 후 예산 축소로 종료.',
    created_by: null,
    created_at: ts(-320),
    updated_at: ts(-140)
  },
  {
    id: 'sample-partner-8',
    company_name: 'NH투자증권',
    partner_type: 'securities',
    grade: 'B',
    contact_name: '강민석 차장',
    contact_email: 'ms.kang@nhqv.example',
    contact_phone: '1544-0000',
    tags: ['나무증권', '신규 리드'],
    status: 'active',
    memo: '첫 미팅 완료. 제안서 대기 중.',
    created_by: null,
    created_at: ts(-10),
    updated_at: ts(-2)
  }
]

const partnerName = (id: string | null) => SAMPLE_PARTNERS.find((p) => p.id === id)?.company_name || null

const rawDeals: Array<Omit<Deal, 'partner_name' | 'owner_name'>> = [
  {
    id: 'sample-deal-1',
    partner_id: 'sample-partner-8',
    campaign_name: '나무증권 신규 계좌 이벤트 소개',
    stage: 'lead',
    expected_amount: 12_000_000,
    owner_user_id: 'sample-user-2',
    planned_publish_on: d(35),
    next_action: '제안서 초안 송부',
    next_action_on: d(2),
    close_reason: null,
    created_at: ts(-9),
    updated_at: ts(-2)
  },
  {
    id: 'sample-deal-2',
    partner_id: 'sample-partner-5',
    campaign_name: '한경TV 주간 코너 시즌2 공동제작',
    stage: 'lead',
    expected_amount: 8_000_000,
    owner_user_id: 'sample-user-4',
    planned_publish_on: null,
    next_action: '편성 일정 회신 대기',
    next_action_on: d(6),
    close_reason: null,
    created_at: ts(-5),
    updated_at: ts(-1)
  },
  {
    id: 'sample-deal-3',
    partner_id: 'sample-partner-3',
    campaign_name: '토스증권 해외주식 소수점 투자 숏폼 6편',
    stage: 'proposal',
    expected_amount: 18_000_000,
    owner_user_id: 'sample-user-1',
    planned_publish_on: d(28),
    next_action: '제안서 피드백 반영본 전달',
    next_action_on: d(1),
    close_reason: null,
    created_at: ts(-18),
    updated_at: ts(-1)
  },
  {
    id: 'sample-deal-4',
    partner_id: 'sample-partner-4',
    campaign_name: '삼성증권 리서치 세미나 라이브 중계',
    stage: 'proposal',
    expected_amount: 15_000_000,
    owner_user_id: 'sample-user-3',
    planned_publish_on: d(40),
    next_action: '견적 재산정',
    next_action_on: d(4),
    close_reason: null,
    created_at: ts(-14),
    updated_at: ts(-3)
  },
  {
    id: 'sample-deal-5',
    partner_id: 'sample-partner-2',
    campaign_name: '미래에셋 TIGER ETF 브랜디드 롱폼 3편',
    stage: 'negotiation',
    expected_amount: 45_000_000,
    owner_user_id: 'sample-user-4',
    planned_publish_on: d(21),
    next_action: '면책 문구 삽입 위치 확정 미팅',
    next_action_on: d(3),
    close_reason: null,
    created_at: ts(-30),
    updated_at: ts(-2)
  },
  {
    id: 'sample-deal-6',
    partner_id: 'sample-partner-1',
    campaign_name: '키움 영웅문S# 4분기 이벤트 패키지',
    stage: 'contract',
    expected_amount: 60_000_000,
    owner_user_id: 'sample-user-2',
    planned_publish_on: d(14),
    next_action: '계약서 날인 회수',
    next_action_on: d(5),
    close_reason: null,
    created_at: ts(-42),
    updated_at: ts(-1)
  },
  {
    id: 'sample-deal-7',
    partner_id: 'sample-partner-1',
    campaign_name: '키움 3분기 신규 계좌 이벤트 롱폼 4편',
    stage: 'executing',
    expected_amount: 52_000_000,
    owner_user_id: 'sample-user-2',
    planned_publish_on: d(-7),
    next_action: '3번째 영상 검수 회신',
    next_action_on: d(0),
    close_reason: null,
    created_at: ts(-80),
    updated_at: ts(-4)
  },
  {
    id: 'sample-deal-8',
    partner_id: 'sample-partner-3',
    campaign_name: '토스증권 앱 설치 캠페인 숏폼 10편',
    stage: 'executing',
    expected_amount: 22_000_000,
    owner_user_id: 'sample-user-5',
    planned_publish_on: d(-3),
    next_action: '주간 성과 리포트 공유',
    next_action_on: d(7),
    close_reason: null,
    created_at: ts(-50),
    updated_at: ts(-6)
  },
  {
    id: 'sample-deal-9',
    partner_id: 'sample-partner-2',
    campaign_name: '미래에셋 연금저축 ETF 특집',
    stage: 'won',
    expected_amount: 38_000_000,
    owner_user_id: 'sample-user-1',
    planned_publish_on: d(-45),
    next_action: null,
    next_action_on: null,
    close_reason: '전 편 집행 완료, 정산 마감',
    created_at: ts(-120),
    updated_at: ts(-40)
  },
  {
    id: 'sample-deal-10',
    partner_id: 'sample-partner-6',
    campaign_name: '네이버 증권 신규 기능 소개 영상',
    stage: 'won',
    expected_amount: 9_000_000,
    owner_user_id: 'sample-user-6',
    planned_publish_on: d(-100),
    next_action: null,
    next_action_on: null,
    close_reason: '1회성 집행 완료',
    created_at: ts(-160),
    updated_at: ts(-95)
  },
  {
    id: 'sample-deal-11',
    partner_id: 'sample-partner-7',
    campaign_name: '인베스팅 프로 구독 프로모션',
    stage: 'lost',
    expected_amount: 7_000_000,
    owner_user_id: 'sample-user-3',
    planned_publish_on: null,
    next_action: null,
    next_action_on: null,
    close_reason: '광고주 예산 축소',
    created_at: ts(-200),
    updated_at: ts(-140)
  },
  {
    id: 'sample-deal-12',
    partner_id: 'sample-partner-4',
    campaign_name: '삼성증권 mPOP 리뉴얼 리뷰',
    stage: 'lost',
    expected_amount: 10_000_000,
    owner_user_id: 'sample-user-5',
    planned_publish_on: null,
    next_action: null,
    next_action_on: null,
    close_reason: '경쟁 채널 선정',
    created_at: ts(-70),
    updated_at: ts(-33)
  }
]

export const SAMPLE_DEALS: Deal[] = rawDeals.map((deal) => ({
  ...deal,
  partner_name: partnerName(deal.partner_id) || '',
  owner_name: staffName(deal.owner_user_id)
}))

const dealName = (id: string | null) => SAMPLE_DEALS.find((x) => x.id === id)?.campaign_name || null

const rawContracts: Array<Omit<Contract, 'partner_name'>> = [
  {
    id: 'sample-contract-1',
    partner_id: 'sample-partner-1',
    deal_id: 'sample-deal-7',
    campaign_name: '키움 3분기 신규 계좌 이벤트 롱폼 4편',
    amount: 52_000_000,
    starts_on: d(-60),
    ends_on: d(12),
    ad_disclosure: true,
    deliverables: '롱폼 4편 + 커뮤니티 게시글 2건',
    status: 'executing',
    document_url: 'https://drive.example.com/kiwoom-q3-contract',
    created_at: ts(-62),
    updated_at: ts(-10)
  },
  {
    id: 'sample-contract-2',
    partner_id: 'sample-partner-3',
    deal_id: 'sample-deal-8',
    campaign_name: '토스증권 앱 설치 캠페인 숏폼 10편',
    amount: 22_000_000,
    starts_on: d(-30),
    ends_on: d(25),
    ad_disclosure: true,
    deliverables: '숏폼 10편',
    status: 'executing',
    document_url: 'https://drive.example.com/toss-shorts-contract',
    created_at: ts(-32),
    updated_at: ts(-6)
  },
  {
    id: 'sample-contract-3',
    partner_id: 'sample-partner-1',
    deal_id: 'sample-deal-6',
    campaign_name: '키움 영웅문S# 4분기 이벤트 패키지',
    amount: 60_000_000,
    starts_on: d(10),
    ends_on: d(100),
    ad_disclosure: true,
    deliverables: '롱폼 4편 + 숏폼 8편',
    status: 'draft',
    document_url: null,
    created_at: ts(-3),
    updated_at: ts(-1)
  },
  {
    id: 'sample-contract-4',
    partner_id: 'sample-partner-5',
    deal_id: null,
    campaign_name: '한경TV 주간 코너 공동제작(시즌1)',
    amount: 6_000_000,
    starts_on: d(-150),
    ends_on: d(4),
    ad_disclosure: false,
    deliverables: '주 1회 출연 · 총 24회',
    status: 'signed',
    document_url: 'https://drive.example.com/wowtv-season1',
    created_at: ts(-155),
    updated_at: ts(-20)
  },
  {
    id: 'sample-contract-5',
    partner_id: 'sample-partner-2',
    deal_id: 'sample-deal-9',
    campaign_name: '미래에셋 연금저축 ETF 특집',
    amount: 38_000_000,
    starts_on: d(-110),
    ends_on: d(-40),
    ad_disclosure: true,
    deliverables: '롱폼 3편 + 숏폼 3편',
    status: 'expired',
    document_url: 'https://drive.example.com/mirae-pension',
    created_at: ts(-112),
    updated_at: ts(-40)
  },
  {
    id: 'sample-contract-6',
    partner_id: 'sample-partner-6',
    deal_id: 'sample-deal-10',
    campaign_name: '네이버 증권 신규 기능 소개 영상',
    amount: 9_000_000,
    starts_on: d(-130),
    ends_on: d(-95),
    ad_disclosure: true,
    deliverables: '롱폼 1편',
    status: 'expired',
    document_url: null,
    created_at: ts(-132),
    updated_at: ts(-95)
  },
  {
    id: 'sample-contract-7',
    partner_id: 'sample-partner-2',
    deal_id: 'sample-deal-5',
    campaign_name: '미래에셋 TIGER ETF 브랜디드 롱폼 3편',
    amount: 45_000_000,
    starts_on: d(15),
    ends_on: d(75),
    ad_disclosure: true,
    deliverables: '롱폼 3편',
    status: 'draft',
    document_url: null,
    created_at: ts(-2),
    updated_at: ts(-2)
  }
]

export const SAMPLE_CONTRACTS: Contract[] = rawContracts.map((c) => ({ ...c, partner_name: partnerName(c.partner_id) || '' }))

const rawActivities: Array<Omit<Activity, 'partner_name' | 'deal_name' | 'author_name'>> = [
  {
    id: 'sample-act-1',
    partner_id: 'sample-partner-1',
    deal_id: 'sample-deal-7',
    activity_type: 'email',
    occurred_at: ts(0, 9),
    summary: '3번째 영상 초안 검수 요청 메일 발송. 유료광고 고지 자막 위치 캡처 첨부.',
    next_step: '검수 회신 확인',
    next_step_on: d(1),
    created_by: 'sample-user-2',
    created_at: ts(0, 9)
  },
  {
    id: 'sample-act-2',
    partner_id: 'sample-partner-2',
    deal_id: 'sample-deal-5',
    activity_type: 'meeting',
    occurred_at: ts(-1, 14),
    summary: '면책 문구를 영상 도입부 5초 + 고정 댓글에 동시 노출하는 안으로 합의. 금액 4,500만원 재확인.',
    next_step: '계약서 초안 작성',
    next_step_on: d(3),
    created_by: 'sample-user-4',
    created_at: ts(-1, 15)
  },
  {
    id: 'sample-act-3',
    partner_id: 'sample-partner-3',
    deal_id: 'sample-deal-3',
    activity_type: 'messenger',
    occurred_at: ts(-1, 11),
    summary: '숏폼 6편 구성안에 대해 2편은 해외 ETF로 바꿔달라는 요청.',
    next_step: '구성안 수정본 공유',
    next_step_on: d(1),
    created_by: 'sample-user-1',
    created_at: ts(-1, 11)
  },
  {
    id: 'sample-act-4',
    partner_id: 'sample-partner-8',
    deal_id: 'sample-deal-1',
    activity_type: 'meeting',
    occurred_at: ts(-2, 10),
    summary: 'NH투자증권 첫 미팅. 나무증권 신규 계좌 이벤트 소개 영상 1편 + 숏폼 2편 규모로 논의.',
    next_step: '제안서 초안 송부',
    next_step_on: d(2),
    created_by: 'sample-user-2',
    created_at: ts(-2, 12)
  },
  {
    id: 'sample-act-5',
    partner_id: 'sample-partner-4',
    deal_id: 'sample-deal-4',
    activity_type: 'call',
    occurred_at: ts(-3, 16),
    summary: '세미나 라이브 중계 장비/인력 비용 포함 여부 문의. 견적 재산정 필요.',
    next_step: '견적서 v2 전달',
    next_step_on: d(4),
    created_by: 'sample-user-3',
    created_at: ts(-3, 16)
  },
  {
    id: 'sample-act-6',
    partner_id: 'sample-partner-1',
    deal_id: 'sample-deal-6',
    activity_type: 'email',
    occurred_at: ts(-4, 17),
    summary: '4분기 패키지 계약서 최종본 송부. 법무 검토 후 날인 예정이라는 회신.',
    next_step: '날인본 회수',
    next_step_on: d(5),
    created_by: 'sample-user-2',
    created_at: ts(-4, 17)
  },
  {
    id: 'sample-act-7',
    partner_id: 'sample-partner-5',
    deal_id: 'sample-deal-2',
    activity_type: 'memo',
    occurred_at: ts(-5, 13),
    summary: '시즌1 계약 만료 임박. 시즌2 연장 시 출연료 15% 인상안으로 제안하기로 내부 결정.',
    next_step: null,
    next_step_on: null,
    created_by: 'sample-user-4',
    created_at: ts(-5, 13)
  },
  {
    id: 'sample-act-8',
    partner_id: 'sample-partner-3',
    deal_id: 'sample-deal-8',
    activity_type: 'email',
    occurred_at: ts(-6, 10),
    summary: '앱 설치 캠페인 2주차 성과(설치 1,240건) 리포트 공유.',
    next_step: '3주차 리포트',
    next_step_on: d(7),
    created_by: 'sample-user-5',
    created_at: ts(-6, 10)
  },
  {
    id: 'sample-act-9',
    partner_id: 'sample-partner-6',
    deal_id: null,
    activity_type: 'messenger',
    occurred_at: ts(-12, 15),
    summary: '하반기 신규 기능 출시 시 다시 연락 주겠다는 답변. 휴면 전환.',
    next_step: null,
    next_step_on: null,
    created_by: 'sample-user-6',
    created_at: ts(-12, 15)
  },
  {
    id: 'sample-act-10',
    partner_id: 'sample-partner-2',
    deal_id: null,
    activity_type: 'call',
    occurred_at: ts(-20, 11),
    summary: '연금저축 특집 정산 완료 확인. 다음 캠페인(TIGER ETF) 논의 시작.',
    next_step: null,
    next_step_on: null,
    created_by: 'sample-user-1',
    created_at: ts(-20, 11)
  }
]

export const SAMPLE_ACTIVITIES: Activity[] = rawActivities.map((a) => ({
  ...a,
  partner_name: partnerName(a.partner_id),
  deal_name: dealName(a.deal_id),
  author_name: staffName(a.created_by)
}))

export const SAMPLE_RISK_ISSUES: RiskIssue[] = [
  {
    id: 'sample-risk-1',
    title: '키움 3번째 영상 유료광고 고지 자막 누락 가능성',
    video_id: null,
    partner_id: 'sample-partner-1',
    severity: 'high',
    status: 'in_progress',
    action_note: '편집본 재검수 후 도입부 자막 삽입. 업로드 전 재확인.',
    created_by: 'sample-user-2',
    created_at: ts(-1, 9),
    updated_at: ts(0, 9),
    video_title: null,
    partner_name: '키움증권',
    author_name: '박준혁'
  },
  {
    id: 'sample-risk-2',
    title: '특정 종목 목표가 언급 영상 — 투자 권유로 오인될 소지',
    video_id: null,
    partner_id: null,
    severity: 'medium',
    status: 'open',
    action_note: null,
    created_by: 'sample-user-4',
    created_at: ts(-3, 10),
    updated_at: ts(-3, 10),
    video_title: null,
    partner_name: null,
    author_name: '최하늘'
  },
  {
    id: 'sample-risk-3',
    title: '썸네일 "100% 수익" 문구 사용',
    video_id: null,
    partner_id: null,
    severity: 'high',
    status: 'resolved',
    action_note: '썸네일 교체 완료(과장 문구 삭제).',
    created_by: 'sample-user-1',
    created_at: ts(-10, 9),
    updated_at: ts(-8, 9),
    video_title: null,
    partner_name: null,
    author_name: '김서연'
  },
  {
    id: 'sample-risk-4',
    title: '한경TV 공동제작 콘텐츠 출처 표기 형식 불일치',
    video_id: null,
    partner_id: 'sample-partner-5',
    severity: 'low',
    status: 'resolved',
    action_note: '설명란 표기 형식 통일.',
    created_by: 'sample-user-4',
    created_at: ts(-25, 9),
    updated_at: ts(-22, 9),
    video_title: null,
    partner_name: '한국경제TV',
    author_name: '최하늘'
  }
]
