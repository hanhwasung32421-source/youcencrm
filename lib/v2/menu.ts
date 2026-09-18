// V2 SEO·발견성 최적화 CRM 메뉴. 권한은 DB가 아니라 역할(roleType)만으로 판단한다.
export type MenuAudience = 'admin' | 'staff' | 'all'

export type MenuDefinition = {
  key: string
  label: string
  href: string
  audience: MenuAudience
  group: string
  description?: string
}

export const MENU_DEFINITIONS: readonly MenuDefinition[] = [
  { key: 'register', label: '영상 등록', href: '/v2/register', audience: 'all', group: '등록', description: '유튜브 URL 등록 + SEO 가이드' },
  { key: 'optimization', label: '제목·썸네일 최적화 보드', href: '/v2/optimization', audience: 'all', group: '최적화', description: '영상별 SEO 스코어카드' },
  { key: 'keywords', label: '키워드·트렌드 레이더', href: '/v2/keywords', audience: 'all', group: '최적화', description: '지금 다뤄야 할 검색 키워드' },
  { key: 'planner', label: '발행 모멘텀 플래너', href: '/v2/planner', audience: 'admin', group: '운영', description: '요일×담당자 업로드 계획' },
  { key: 'report', label: '검색 성과 리포트', href: '/v2/report', audience: 'admin', group: '운영', description: '발견성 점수 리더보드' }
] as const

export const V2_HOME_HREF = '/v2/register'

export function isAdminRoleType(roleType: string | null | undefined) {
  return roleType === 'super_admin' || roleType === 'admin'
}

export function getMenusForRole(isAdmin: boolean): MenuDefinition[] {
  return MENU_DEFINITIONS.filter((menu) => menu.audience === 'all' || (isAdmin ? menu.audience === 'admin' : menu.audience === 'staff'))
}

export function groupMenus(menus: MenuDefinition[]): { group: string; items: MenuDefinition[] }[] {
  const groups: { group: string; items: MenuDefinition[] }[] = []
  for (const menu of menus) {
    let bucket = groups.find((g) => g.group === menu.group)
    if (!bucket) {
      bucket = { group: menu.group, items: [] }
      groups.push(bucket)
    }
    bucket.items.push(menu)
  }
  return groups
}
