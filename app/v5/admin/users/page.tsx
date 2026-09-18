'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/v5/app-shell'
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
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [addingRole, setAddingRole] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { toast, showSuccess, showError } = useToast()

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return items
    return items.filter(
      (user) => user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)
    )
  }, [items, searchQuery])

  const updateUserRoleCode = (userId: string, roleCode: string) => {
    const role = roles.find((item) => item.code === roleCode)
    setItems((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, role_code: roleCode, role_name: role?.name || roleCode } : user))
    )
  }

  const loadUsers = async () => {
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
    <>
      <PageHeader title="직원 직급 관리" subtitle="총 관리자와 관리자는 하위 직원의 직급을 변경할 수 있습니다." />
        <Toast toast={toast} />
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">직급 편집 목록</div>
              <p className="panel-subtitle">직원별 직급을 문서 행처럼 확인하고 바로 수정할 수 있습니다.</p>
            </div>
            <Link className="button secondary nowrap" href="/v5/admin/menu-permissions">
              메뉴 권한 관리로 이동
            </Link>
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <input
              className="input"
              placeholder="이름 또는 이메일로 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="list">
            {filteredItems.length === 0 ? (
              <div className="empty-state">검색 결과가 없습니다.</div>
            ) : (
              filteredItems.map((user) => (
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
                        onChange={(e) => updateUserRoleCode(user.id, e.target.value)}
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
              ))
            )}
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
    </>
  )
}
