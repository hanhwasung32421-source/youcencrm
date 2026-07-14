'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { MENU_DEFINITIONS, ROLE_TYPES } from '@/lib/menu-permissions'

type RoleType = (typeof ROLE_TYPES)[number]
type MenuItem = (typeof MENU_DEFINITIONS)[number]

const roleLabels: Record<RoleType, string> = {
  super_admin: '총 관리자',
  admin: '관리자',
  general_manager: '부장',
  manager: '과장',
  assistant_manager: '대리',
  senior_staff: '주임',
  staff: '직원',
  retired: '퇴사'
}

export default function AdminMenuPermissionsPage() {
  const [selectedRole, setSelectedRole] = useState<RoleType>('staff')
  const [items, setItems] = useState<Record<string, string[]>>({})
  const [menus, setMenus] = useState<MenuItem[]>([...MENU_DEFINITIONS])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadPermissions = async () => {
    setError('')
    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const res = await fetch('/api/admin/menu-permissions', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data?.error || '메뉴 권한 조회 실패')
      return
    }

    setMenus(data.menus || [...MENU_DEFINITIONS])
    setItems(data.items || {})
  }

  useEffect(() => {
    void loadPermissions()
  }, [])

  const selectedMenuKeys = useMemo(() => new Set(items[selectedRole] || []), [items, selectedRole])

  const toggleMenu = (menuKey: string) => {
    setItems((prev) => {
      const current = new Set(prev[selectedRole] || [])
      if (current.has(menuKey)) {
        current.delete(menuKey)
      } else {
        current.add(menuKey)
      }
      return { ...prev, [selectedRole]: Array.from(current) }
    })
  }

  const save = async () => {
    setMessage('')
    setError('')

    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const res = await fetch('/api/admin/menu-permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: session.access_token,
        roleType: selectedRole,
        menuKeys: Array.from(selectedMenuKeys)
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data?.error || '메뉴 권한 저장 실패')
      return
    }

    setMessage('메뉴 권한이 저장되었습니다.')
    await loadPermissions()
  }

  return (
    <AuthGuard requireAdmin>
      <AppShell title="메뉴 권한 관리" subtitle="총 관리자가 역할별로 볼 수 있는 메뉴를 직접 체크해서 저장합니다.">
        <div className="grid grid-2">
          <div className="panel form-stack">
            <div className="panel-header">
              <div>
                <div className="panel-title">역할 선택</div>
                <p className="panel-subtitle">먼저 역할을 고른 뒤, 표시할 메뉴를 체크해 주세요.</p>
              </div>
            </div>
            <select className="select" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as RoleType)}>
              {ROLE_TYPES.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>

            <div className="panel soft">
              <div className="panel-title">표시 메뉴</div>
              <div className="list" style={{ marginTop: 16 }}>
                {menus.map((menu) => (
                  <label className="list-item" key={menu.key} style={{ cursor: 'pointer' }}>
                    <div className="row-between">
                      <div>
                        <div>{menu.label}</div>
                        <div className="small muted">{menu.href}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedMenuKeys.has(menu.key)}
                        onChange={() => toggleMenu(menu.key)}
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button className="button" onClick={save}>
              메뉴 권한 저장
            </button>
            {message ? <div className="message-success small">{message}</div> : null}
            {error ? <div className="message-error small">{error}</div> : null}
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">현재 선택 요약</div>
                <p className="panel-subtitle">{roleLabels[selectedRole]} 역할에 표시될 메뉴 목록입니다.</p>
              </div>
            </div>
            <div className="list" style={{ marginTop: 16 }}>
              {(items[selectedRole] || []).length === 0 ? (
                <div className="empty-state">선택된 메뉴가 없습니다.</div>
              ) : (
                menus
                  .filter((menu) => selectedMenuKeys.has(menu.key))
                  .map((menu) => (
                    <div className="list-item" key={menu.key}>
                      <div>{menu.label}</div>
                      <div className="small muted">{menu.href}</div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  )
}

