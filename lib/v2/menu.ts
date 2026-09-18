// V2 콘텐츠 제작 파이프라인 CRM 메뉴. 권한은 DB가 아니라 역할(roleType)만으로 판단한다.
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
  { key: 'board', label: '제작 보드', href: '/v2/board', audience: 'all', group: '제작', description: '기획→촬영→편집→업로드→완료 칸반' },
  { key: 'calendar', label: '콘텐츠 캘린더', href: '/v2/calendar', audience: 'all', group: '제작', description: '마감/게시 예정 주·월 보기' },
  { key: 'topics', label: '종목·이슈 큐', href: '/v2/topics', audience: 'all', group: '제작', description: '다룰 종목/이슈 백로그' },
  { key: 'workload', label: '담당자 워크로드', href: '/v2/workload', audience: 'admin', group: '운영', description: '담당자별 목표/완료/지연' },
  { key: 'checklists', label: '제작 표준/체크리스트', href: '/v2/checklists', audience: 'all', group: '운영', description: '롱폼/숏폼 표준 체크리스트' },
  { key: 'settings_youtube', label: '유튜브 API 연동', href: '/v2/settings/youtube-api', audience: 'admin', group: '설정', description: 'API 키 · 담당자 일일 목표' }
] as const

export const V2_HOME_HREF = '/v2/board'

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
