'use client'

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'
import { PageLoading } from '@/components/page-loading'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'

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
  const [loading, setLoading] = useState(true)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [addingRole, setAddingRole] = useState(false)
  const { toast, showSuccess, showError } = useToast()

  const loadUsers = async () => {
    try {
      const [usersResult, rolesResult] = await Promise.all([
        authedFetchJson<{ items: UserItem[]; error?: string }>('/api/admin/users'),
        authedFetchJson<{ items: RoleItem[]; error?: string }>('/api/admin/roles')
      ])
      if (!usersResult.ok) {
        showError(usersResult.data?.error || '직원 목록 조회 실패')
        return
      }
      if (!rolesResult.ok) {
        showError(rolesResult.data?.error || '직급 목록 조회 실패')
        return
      }
      setItems(usersResult.data.items || [])
      setRoles(rolesResult.data.items || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  const addRole = async () => {
    if (!newRoleName.trim()) {
      showError('직급 이름을 입력해 주세요.')
      return
    }

    if (addingRole) return
    setAddingRole(true)
    try {
      const { ok, data } = await authedPostJson<{ error?: string }>('/api/admin/roles', {
        code: newRoleCode || newRoleName,
        name: newRoleName
      })
      if (!ok) {
        showError(data?.error || '직급 추가 실패')
        return
      }

      setNewRoleName('')
      setNewRoleCode('')
      showSuccess('직급이 추가되었습니다. 기본 메뉴 권한은 없습니다.')
      await loadUsers()
    } finally {
      setAddingRole(false)
    }
  }

  const saveRole = async (userId: string, roleType: string) => {
    const user = items.find((item) => item.id === userId)
    const role = roles.find((item) => item.code === roleType)
    const confirmed = window.confirm(
      `${user?.name || '이 직원'}님의 직급을 "${role?.name || roleType}"(으)로 변경할까요?`
    )
    if (!confirmed) return

    if (savingUserId) return
    setSavingUserId(userId)
    try {
      const { ok, data } = await authedPostJson<{ error?: string }>('/api/admin/users/role', { userId, roleType })
      if (!ok) {
        showError(data?.error || '직급 저장 실패')
        return
      }

      showSuccess('직급이 저장되었습니다.')
      await loadUsers()
    } finally {
      setSavingUserId(null)
    }
  }

  return (
    <AuthGuard requireAdmin>
      <AppShell title="직원 직급 관리" subtitle="총 관리자와 관리자는 하위 직원의 직급을 변경할 수 있습니다.">
        {loading ? <PageLoading text="직원 목록을 불러오는 중입니다..." /> : null}
        <Toast toast={toast} />
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
                    <button
                      className="button"
                      disabled={savingUserId === user.id}
                      onClick={() => saveRole(user.id, user.role_code)}
                    >
                      {savingUserId === user.id ? '저장 중...' : '직급 저장'}
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
            <button className="button" style={{ marginTop: 12 }} disabled={addingRole} onClick={addRole}>
              {addingRole ? '추가 중...' : '직급 추가'}
            </button>
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  )
}
