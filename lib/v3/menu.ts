// V3(시청자 참여 · 커뮤니티 성장 CRM) 메뉴. 권한은 DB 메뉴권한 테이블이 아니라
// 역할(roleType)로만 판단한다: super_admin/admin = 관리자, 그 외 = 직원.
// 모든 메뉴는 audience:'all'이며, 화면/데이터 범위(팀 전체 vs 본인)는 각 API가
// 역할에 따라 자체적으로 좁힌다.

export type MenuAudience = 'admin' | 'staff' | 'all'

export type MenuDefinition = {
  key: string
  label: string
  href: string
  audience: MenuAudience
  group: string
  description: string
}

export const MENU_GROUPS = [
  { key: 'content', label: '콘텐츠', icon: '📥' },
  { key: 'insight', label: '참여 인사이트', icon: '💬' },
  { key: 'format', label: '포맷·시리즈', icon: '🧩' }
] as const

export const MENU_DEFINITIONS: MenuDefinition[] = [
  { key: 'register', label: '영상 등록', href: '/v3/register', audience: 'all', group: 'content', description: '유튜브 URL로 새 영상을 등록합니다' },
  { key: 'engagement', label: '참여도 대시보드', href: '/v3/engagement', audience: 'all', group: 'insight', description: '참여율 · 댓글 비율 등 참여 품질 지표' },
  { key: 'lifecycle', label: '조회 성장 곡선', href: '/v3/lifecycle', audience: 'all', group: 'insight', description: '영상별 조회수 라이프사이클' },
  { key: 'viral', label: '바이럴 신호 레이더', href: '/v3/viral', audience: 'all', group: 'insight', description: '조회 속도가 급상승한 영상 감지' },
  { key: 'series', label: '형식 · 시리즈 효과', href: '/v3/series', audience: 'all', group: 'format', description: '롱폼 · 숏폼, 시리즈별 참여 효율 비교' }
]

export const ADMIN_ROLE_TYPES = ['super_admin', 'admin']

export function isAdminRole(roleType: string | null | undefined) {
  return !!roleType && ADMIN_ROLE_TYPES.includes(roleType)
}

// 관리자 홈 = 참여도 대시보드(팀 현황), 직원 홈 = 영상 등록(매일 하는 작업)
export function getHomeHref(roleType: string | null | undefined) {
  return isAdminRole(roleType) ? '/v3/engagement' : '/v3/register'
}

export function getMenuByPath(pathname: string): MenuDefinition | null {
  return MENU_DEFINITIONS.find((menu) => pathname === menu.href || pathname.startsWith(`${menu.href}/`)) || null
}

export function getVisibleMenus(roleType: string | null | undefined) {
  const admin = isAdminRole(roleType)
  return MENU_DEFINITIONS.filter((menu) => menu.audience === 'all' || (admin ? menu.audience === 'admin' : menu.audience === 'staff'))
}
