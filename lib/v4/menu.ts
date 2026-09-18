import { TABLES } from '@/lib/supabase/tables'

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
  { key: 'creator_dashboard', label: '대시보드', href: '/v4/creator/dashboard', audience: 'creator' },
  { key: 'creator_videos', label: '영상등록', href: '/v4/creator/videos', audience: 'creator' },
  { key: 'admin_dashboard', label: '대시보드 - 관리자', href: '/v4/admin/dashboard', audience: 'admin' },
  { key: 'admin_channels', label: '채널 현황 - 관리자', href: '/v4/admin/channels', audience: 'admin' },
  { key: 'admin_users', label: '직급관리 - 관리자', href: '/v4/admin/users', audience: 'admin' },
  { key: 'admin_attendance', label: '근태관리 - 관리자', href: '/v4/admin/attendance', audience: 'admin' },
  { key: 'admin_menu_permissions', label: '메뉴권한 - 관리자', href: '/v4/admin/menu-permissions', audience: 'admin' },
  { key: 'admin_youtube_accounts', label: '유튜브 계정 관리 - 관리자', href: '/v4/admin/youtube-accounts', audience: 'admin' }
] as const

export type MenuKey = (typeof MENU_DEFINITIONS)[number]['key']

type PermissionRow = {
  role_type: string
  menu_key: MenuKey
  can_view: boolean
}

export const DEFAULT_ROLE_MENU_KEYS: Record<BuiltinRoleType, MenuKey[]> = {
  super_admin: ['admin_dashboard', 'admin_channels', 'admin_users', 'admin_attendance', 'admin_menu_permissions', 'admin_youtube_accounts'],
  admin: ['admin_dashboard', 'admin_channels', 'admin_users', 'admin_attendance', 'admin_youtube_accounts'],
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
  const [{ data: roles }, { data, error }] = await Promise.all([
    supabaseAdmin.from(TABLES.roles).select('code').order('created_at', { ascending: true }),
    supabaseAdmin.from(TABLES.roleMenuPermissions).select('role_type, menu_key, can_view')
  ])

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

  // DB에 저장된 적이 한 번도 없는 menu_key는 "새로 배포된 메뉴"로 간주한다. 이미 커스터마이징된
  // 역할이라도 신규 메뉴만큼은 기본값으로 보충해서, 관리자가 메뉴권한 화면에서 직접 켜주기 전까지
  // 화면 자체가 통째로 사라지는 일이 없게 한다.
  const configuredMenuKeys = new Set(rows.map((row) => row.menu_key))

  for (const row of rows) {
    if (!row.can_view) continue
    if (!MENU_DEFINITIONS.some((menu) => menu.key === row.menu_key)) continue
    if (!next[row.role_type]) next[row.role_type] = []
    next[row.role_type].push(row.menu_key)
  }

  for (const role of Object.keys(defaults)) {
    if (next[role].length === 0 && defaults[role].length > 0) {
      next[role] = [...defaults[role]]
      continue
    }
    for (const key of defaults[role]) {
      if (!configuredMenuKeys.has(key) && !next[role].includes(key)) {
        next[role].push(key)
      }
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
  if (fallbackRoleType && ['super_admin', 'admin'].includes(fallbackRoleType)) return '/v4/admin/dashboard'
  return '/v4/creator/dashboard'
}
