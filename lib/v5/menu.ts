// V5 성장 실험 · 알고리즘 최적화 캔버스 CRM 메뉴.
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
    key: 'register',
    label: '영상 등록',
    href: '/v5/register',
    audience: 'all',
    group: '등록',
    icon: '⬒',
    description: '유튜브 영상 URL을 등록하고 통계를 자동으로 불러온다'
  },
  {
    key: 'canvas',
    label: '성장 실험 캔버스',
    href: '/v5/canvas',
    audience: 'all',
    group: '실험',
    icon: '⧉',
    description: '다차원 성장 실험을 칸반으로 설계·추적한다'
  },
  {
    key: 'scoreboard',
    label: '알고리즘 친화도 스코어보드',
    href: '/v5/scoreboard',
    audience: 'all',
    group: '분석',
    icon: '◔',
    description: '영상별 알고리즘 친화도 점수와 분포를 본다'
  },
  {
    key: 'playbook',
    label: '발행 전략 플레이북',
    href: '/v5/playbook',
    audience: 'all',
    group: '전략',
    icon: '▥',
    description: '성공 패턴을 코드화하고 재사용한다'
  },
  {
    key: 'retros',
    label: '성장 회고 노트',
    href: '/v5/retros',
    audience: 'admin',
    group: '회고',
    icon: '✎',
    description: '주간 성장 회고와 다음 주 액션 아이템'
  }
] as const

export const ADMIN_HOME_HREF = '/v5/canvas'
export const STAFF_HOME_HREF = '/v5/register'

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
