export const BUILTIN_ROLE_TYPES = [
  'super_admin',
  'admin',
  'general_manager',
  'manager',
  'assistant_manager',
  'senior_staff',
  'staff',
  'retired'
] as const

export type BuiltinRoleType = (typeof BUILTIN_ROLE_TYPES)[number]

export const MENU_DEFINITIONS = [
  { key: 'creator_dashboard', label: '대시보드', href: '/creator/dashboard', audience: 'creator' },
  { key: 'creator_videos', label: '영상등록', href: '/creator/videos', audience: 'creator' },
  { key: 'admin_dashboard', label: '대시보드 - 관리자', href: '/admin/dashboard', audience: 'admin' },
  { key: 'admin_users', label: '직급관리 - 관리자', href: '/admin/users', audience: 'admin' },
  { key: 'admin_attendance', label: '근태관리 - 관리자', href: '/admin/attendance', audience: 'admin' },
  { key: 'admin_menu_permissions', label: '메뉴권한 - 관리자', href: '/admin/menu-permissions', audience: 'admin' }
] as const

export type MenuKey = (typeof MENU_DEFINITIONS)[number]['key']

type PermissionRow = {
  role_type: string
  menu_key: MenuKey
  can_view: boolean
}

export const DEFAULT_ROLE_MENU_KEYS: Record<BuiltinRoleType, MenuKey[]> = {
  super_admin: ['admin_dashboard', 'admin_users', 'admin_attendance', 'admin_menu_permissions'],
  admin: ['admin_dashboard', 'admin_users', 'admin_attendance'],
  general_manager: ['creator_dashboard', 'creator_videos'],
  manager: ['creator_dashboard', 'creator_videos'],
  assistant_manager: ['creator_dashboard', 'creator_videos'],
  senior_staff: ['creator_dashboard', 'creator_videos'],
  staff: ['creator_dashboard', 'creator_videos'],
  retired: []
}

export function isBuiltinRoleType(value: string): value is BuiltinRoleType {
  return BUILTIN_ROLE_TYPES.includes(value as BuiltinRoleType)
}

export function getDefaultRoleMenuMap(): Record<string, MenuKey[]> {
  return {
    super_admin: [...DEFAULT_ROLE_MENU_KEYS.super_admin],
    admin: [...DEFAULT_ROLE_MENU_KEYS.admin],
    general_manager: [...DEFAULT_ROLE_MENU_KEYS.general_manager],
    manager: [...DEFAULT_ROLE_MENU_KEYS.manager],
    assistant_manager: [...DEFAULT_ROLE_MENU_KEYS.assistant_manager],
    senior_staff: [...DEFAULT_ROLE_MENU_KEYS.senior_staff],
    staff: [...DEFAULT_ROLE_MENU_KEYS.staff],
    retired: [...DEFAULT_ROLE_MENU_KEYS.retired]
  }
}

export async function loadRoleMenuMap(supabaseAdmin: any): Promise<Record<string, MenuKey[]>> {
  const defaults = getDefaultRoleMenuMap()
  const { data: roles } = await supabaseAdmin.from('roles').select('code').order('created_at', { ascending: true })
  const { data, error } = await supabaseAdmin
    .from('role_menu_permissions')
    .select('role_type, menu_key, can_view')

  if (error || !data) {
    return defaults
  }

  const rows = data as PermissionRow[]
  const next: Record<string, MenuKey[]> = {}
  for (const role of roles || []) {
    next[role.code] = []
  }
  for (const roleCode of Object.keys(defaults)) {
    if (!next[roleCode]) next[roleCode] = []
  }

  for (const row of rows) {
    if (!row.can_view) continue
    if (!MENU_DEFINITIONS.some((menu) => menu.key === row.menu_key)) continue
    if (!next[row.role_type]) next[row.role_type] = []
    next[row.role_type].push(row.menu_key)
  }

  for (const role of Object.keys(defaults)) {
    if (next[role].length === 0 && defaults[role].length > 0) {
      next[role] = [...defaults[role]]
    }
  }

  return next
}

export async function getAllowedMenuKeysForRole(supabaseAdmin: any, roleType: string): Promise<MenuKey[]> {
  const map = await loadRoleMenuMap(supabaseAdmin)
  return map[roleType] || []
}

export function getMenuDefinition(key: string) {
  return MENU_DEFINITIONS.find((menu) => menu.key === key)
}

export function getMenuKeyByPath(pathname: string): MenuKey | null {
  const match = MENU_DEFINITIONS.find((menu) => pathname === menu.href || pathname.startsWith(`${menu.href}/`))
  return match?.key || null
}

export function getFirstAllowedHref(menuKeys: string[], fallbackRoleType?: string) {
  const first = MENU_DEFINITIONS.find((menu) => menuKeys.includes(menu.key))
  if (first) return first.href
  if (fallbackRoleType && ['super_admin', 'admin'].includes(fallbackRoleType)) return '/admin/dashboard'
  return '/creator/dashboard'
}
