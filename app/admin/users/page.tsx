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
  employment_status: string
}

const roles = [
  { value: 'super_admin', label: '총 관리자' },
  { value: 'admin', label: '관리자' },
  { value: 'general_manager', label: '부장' },
  { value: 'manager', label: '과장' },
  { value: 'assistant_manager', label: '대리' },
  { value: 'senior_staff', label: '주임' },
  { value: 'staff', label: '직원' },
  { value: 'retired', label: '퇴사' }
]

export default function AdminUsersPage() {
  const [items, setItems] = useState<UserItem[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadUsers = async () => {
    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data?.error || '직원 목록 조회 실패')
      return
    }
    setItems(data.items || [])
  }

  useEffect(() => {
    void loadUsers()
  }, [])

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
                      value={user.role_type}
                      onChange={(e) => {
                        const next = [...items]
                        next[index] = { ...user, role_type: e.target.value }
                        setItems(next)
                      }}
                    >
                      {roles.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                    <button className="button" onClick={() => saveRole(user.id, user.role_type)}>
                      직급 저장
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {message ? <div className="message-success small" style={{ marginTop: 16 }}>{message}</div> : null}
          {error ? <div className="message-error small" style={{ marginTop: 16 }}>{error}</div> : null}
        </div>
      </AppShell>
    </AuthGuard>
  )
}

