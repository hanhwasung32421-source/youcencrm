// V5 파트너 · 협찬 딜 · 컴플라이언스 CRM 메뉴.
// 메뉴 권한은 DB(youtubeCRM_role_menu_permissions)를 보지 않고 역할(role_type)만으로 판단한다.
// super_admin/admin = 관리자, 그 외 = 직원.

export type MenuAudience = 'admin' | 'staff' | 'all'

export type MenuDefinition = {
  key: string
  label: string
  href: string
  audience: MenuAudience
  group: string
  icon: string
  description: string
}

export const MENU_DEFINITIONS: readonly MenuDefinition[] = [
  {
    key: 'dashboard',
    label: '파트너 대시보드',
    href: '/v5/dashboard',
    audience: 'admin',
    group: '개요',
    icon: '◧',
    description: '파트너·딜·계약·컴플라이언스 현황을 위젯으로 한눈에'
  },
  {
    key: 'partners',
    label: '파트너 · 광고주',
    href: '/v5/partners',
    audience: 'admin',
    group: '파트너 관계',
    icon: '◎',
    description: '광고주 · 증권사 · PR대행사 · 플랫폼 파트너 관리'
  },
  {
    key: 'deals',
    label: '딜 파이프라인',
    href: '/v5/deals',
    audience: 'admin',
    group: '파트너 관계',
    icon: '⇶',
    description: '리드부터 집행 완료까지 협찬 딜 단계 관리'
  },
  {
    key: 'contracts',
    label: '계약 · 일정',
    href: '/v5/contracts',
    audience: 'admin',
    group: '파트너 관계',
    icon: '▤',
    description: '계약 금액 · 기간 · 산출물 · 만료 일정'
  },
  {
    key: 'activities',
    label: '커뮤니케이션 로그',
    href: '/v5/activities',
    audience: 'all',
    group: '기록',
    icon: '✎',
    description: '미팅 · 통화 · 이메일 · 메신저 · 메모 기록'
  },
  {
    key: 'compliance',
    label: '컴플라이언스 체크',
    href: '/v5/compliance',
    audience: 'all',
    group: '리스크',
    icon: '✓',
    description: '영상별 고지/면책 체크리스트와 리스크 이슈'
  }
] as const

export const ADMIN_HOME_HREF = '/v5/dashboard'
export const STAFF_HOME_HREF = '/v5/compliance'

export function isAdminRoleType(roleType: string | null | undefined) {
  return roleType === 'super_admin' || roleType === 'admin'
}

export function getHomeHref(roleType: string | null | undefined) {
  return isAdminRoleType(roleType) ? ADMIN_HOME_HREF : STAFF_HOME_HREF
}

export function getMenusForRole(roleType: string | null | undefined) {
  const admin = isAdminRoleType(roleType)
  return MENU_DEFINITIONS.filter((menu) => menu.audience === 'all' || (admin ? menu.audience === 'admin' : menu.audience === 'staff'))
}

export function findMenuByPath(pathname: string) {
  return MENU_DEFINITIONS.find((menu) => pathname === menu.href || pathname.startsWith(`${menu.href}/`)) || null
}

export function canAccessPath(pathname: string, roleType: string | null | undefined) {
  const menu = findMenuByPath(pathname)
  if (!menu) return true
  if (menu.audience === 'all') return true
  return menu.audience === 'admin' ? isAdminRoleType(roleType) : !isAdminRoleType(roleType)
}
