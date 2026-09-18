// V4 — 성장 · 성과 분석 CRM 메뉴 정의.
// 메뉴 권한은 DB(role_menu_permissions)를 전혀 보지 않고 역할(role_type)만으로 결정한다.
// super_admin/admin = 관리자, 그 외 = 직원(유튜버).

export type MenuAudience = 'admin' | 'staff' | 'all'

export type MenuDefinition = {
  key: string
  label: string
  href: string
  audience: MenuAudience
  group: string
  description: string
}

export const HOME_HREF = '/v4/dashboard'
export const LOGIN_HREF = '/v4/login'

export const MENU_DEFINITIONS: readonly MenuDefinition[] = [
  {
    key: 'growth_dashboard',
    label: '성장 대시보드',
    href: '/v4/dashboard',
    audience: 'all',
    group: '개요',
    description: '기간별 조회수·업로드 흐름과 목표 달성률'
  },
  {
    key: 'content_ranking',
    label: '콘텐츠 성과 랭킹',
    href: '/v4/ranking',
    audience: 'all',
    group: '콘텐츠 분석',
    description: '영상별 조회수·반응·조회 속도 순위'
  },
  {
    key: 'stock_trends',
    label: '종목 트렌드',
    href: '/v4/stocks',
    audience: 'all',
    group: '콘텐츠 분석',
    description: '종목별 영상 수와 조회수 반응, 전기 대비 추세'
  },
  {
    key: 'upload_timing',
    label: '업로드 타이밍 분석',
    href: '/v4/timing',
    audience: 'all',
    group: '콘텐츠 분석',
    description: '요일 × 시간대 업로드 분포와 평균 조회수'
  },
  {
    key: 'staff_comparison',
    label: '담당자 성과 비교',
    href: '/v4/staff',
    audience: 'admin',
    group: '팀',
    description: '담당자별 업로드·조회수·형식 비중 비교'
  },
  {
    key: 'experiments',
    label: '실험 관리 (A/B 로그)',
    href: '/v4/experiments',
    audience: 'all',
    group: '실험',
    description: '썸네일·제목 실험 기록과 학습 노트'
  }
] as const

export function isAdminRole(roleType: string | null | undefined) {
  return roleType === 'super_admin' || roleType === 'admin'
}

export function getMenusForRole(roleType: string | null | undefined) {
  const admin = isAdminRole(roleType)
  return MENU_DEFINITIONS.filter((menu) => menu.audience === 'all' || (admin ? menu.audience === 'admin' : menu.audience === 'staff'))
}

export function findMenuByPath(pathname: string) {
  return MENU_DEFINITIONS.find((menu) => pathname === menu.href || pathname.startsWith(`${menu.href}/`)) || null
}

export function groupMenus(menus: readonly MenuDefinition[]) {
  const groups: Array<{ group: string; items: MenuDefinition[] }> = []
  for (const menu of menus) {
    const existing = groups.find((g) => g.group === menu.group)
    if (existing) existing.items.push(menu)
    else groups.push({ group: menu.group, items: [menu] })
  }
  return groups
}
