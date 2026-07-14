'use client'

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type UserItem = {
  id: string
  name: string
  email: string
  role_type: string
  role_code: string
  role_name: string
  employment_status: string
}

type RoleItem = {
  code: string
  name: string
}

export default function AdminUsersPage() {
  const [items, setItems] = useState<UserItem[]>([])
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleCode, setNewRoleCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadUsers = async () => {
    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const [usersRes, rolesRes] = await Promise.all([
      fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      }),
      fetch('/api/admin/roles', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
    ])
    const data = await usersRes.json()
    const rolesData = await rolesRes.json().catch(() => ({}))
    if (!usersRes.ok) {
      setError(data?.error || '직원 목록 조회 실패')
      return
    }
    if (!rolesRes.ok) {
      setError(rolesData?.error || '직급 목록 조회 실패')
      return
    }
    setItems(data.items || [])
    setRoles(rolesData.items || [])
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  const addRole = async () => {
    setMessage('')
    setError('')

    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const res = await fetch('/api/admin/roles', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accessToken: session.access_token,
        code: newRoleCode || newRoleName,
        name: newRoleName
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data?.error || '직급 추가 실패')
      return
    }

    setNewRoleName('')
    setNewRoleCode('')
    setMessage('직급이 추가되었습니다. 기본 메뉴 권한은 없습니다.')
    await loadUsers()
  }

  const saveRole = async (userId: string, roleType: string) => {
    setMessage('')
    setError('')

    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const res = await fetch('/api/admin/users/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: session.access_token,
        userId,
        roleType
      })
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data?.error || '직급 저장 실패')
      return
    }

    setMessage('직급이 저장되었습니다.')
    await loadUsers()
  }

  return (
    <AuthGuard requireAdmin>
      <AppShell title="직원 직급 관리" subtitle="총 관리자와 관리자는 하위 직원의 직급을 변경할 수 있습니다.">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">직급 편집 목록</div>
              <p className="panel-subtitle">직원별 직급을 문서 행처럼 확인하고 바로 수정할 수 있습니다.</p>
            </div>
          </div>
          <div className="list">
            {items.map((user, index) => (
              <div className="list-item" key={user.id}>
                <div className="row-between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div>{user.name}</div>
                    <div className="small muted">{user.email}</div>
                  </div>
                  <div className="row">
                    <select
                      className="select"
                      value={user.role_code}
                      onChange={(e) => {
                        const next = [...items]
                        const role = roles.find((item) => item.code === e.target.value)
                        next[index] = {
                          ...user,
                          role_code: e.target.value,
                          role_name: role?.name || e.target.value
                        }
                        setItems(next)
                      }}
                    >
                      {roles.map((role) => (
                        <option key={role.code} value={role.code}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <button className="button" onClick={() => saveRole(user.id, user.role_code)}>
                      직급 저장
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="panel soft" style={{ marginTop: 16 }}>
            <div className="panel-title">직급 추가</div>
            <div className="grid grid-2" style={{ marginTop: 16 }}>
              <div className="field">
                <label className="label">직급 이름</label>
                <input className="input" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
              </div>
              <div className="field">
                <label className="label">직급 코드(선택)</label>
                <input className="input" value={newRoleCode} onChange={(e) => setNewRoleCode(e.target.value)} />
              </div>
            </div>
            <button className="button" style={{ marginTop: 12 }} onClick={addRole}>
              직급 추가
            </button>
          </div>
          {message ? <div className="message-success small" style={{ marginTop: 16 }}>{message}</div> : null}
          {error ? <div className="message-error small" style={{ marginTop: 16 }}>{error}</div> : null}
        </div>
      </AppShell>
    </AuthGuard>
  )
}
