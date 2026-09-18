// V3 수익화 · 정산 CRM 메뉴. 권한은 DB 메뉴권한 테이블이 아니라 역할(roleType)로만
// 판단한다: super_admin/admin = 관리자, 그 외 = 직원.

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
  { key: 'finance', label: '재무', icon: '📊' },
  { key: 'settlement', label: '정산', icon: '🧾' },
  { key: 'rules', label: '규칙', icon: '⚙' }
] as const

export const MENU_DEFINITIONS: MenuDefinition[] = [
  { key: 'dashboard', label: '매출 대시보드', href: '/v3/dashboard', audience: 'admin', group: 'finance', description: '이번 달 매출·순이익과 12개월 추이' },
  { key: 'revenue', label: '수익원 관리', href: '/v3/revenue', audience: 'admin', group: 'finance', description: '월별 수익원 항목 원장' },
  { key: 'expenses', label: '비용 · 손익', href: '/v3/expenses', audience: 'admin', group: 'finance', description: '비용 기록과 월간 손익계산서' },
  { key: 'sponsorships', label: '협찬·광고 정산', href: '/v3/sponsorships', audience: 'admin', group: 'settlement', description: '광고주 인보이스와 미수금' },
  { key: 'incentives', label: '직원 인센티브 정산', href: '/v3/incentives', audience: 'admin', group: 'settlement', description: '월별 직원 정산액 계산·확정' },
  { key: 'my-settlement', label: '내 정산', href: '/v3/my-settlement', audience: 'all', group: 'settlement', description: '내 영상 실적과 예상 인센티브' },
  { key: 'incentive-rules', label: '인센티브 규칙', href: '/v3/incentive-rules', audience: 'admin', group: 'rules', description: '직원별 단가·가중치 설정' }
]

export const ADMIN_ROLE_TYPES = ['super_admin', 'admin']

export function isAdminRole(roleType: string | null | undefined) {
  return !!roleType && ADMIN_ROLE_TYPES.includes(roleType)
}

export function getHomeHref(roleType: string | null | undefined) {
  return isAdminRole(roleType) ? '/v3/dashboard' : '/v3/my-settlement'
}

export function getMenuByPath(pathname: string): MenuDefinition | null {
  return MENU_DEFINITIONS.find((menu) => pathname === menu.href || pathname.startsWith(`${menu.href}/`)) || null
}

export function getVisibleMenus(roleType: string | null | undefined) {
  const admin = isAdminRole(roleType)
  return MENU_DEFINITIONS.filter((menu) => menu.audience === 'all' || (admin ? menu.audience === 'admin' : menu.audience === 'staff'))
}
