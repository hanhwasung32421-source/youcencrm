'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type UserItem = {
  id: string
  name: string
  role_type: string
  employment_status: string
}

type AttendanceDay = {
  id: string
  user_id: string
  work_date: string
  attendance_status: string
}

export default function AdminAttendancePage() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day')
  const [users, setUsers] = useState<UserItem[]>([])
  const [days, setDays] = useState<AttendanceDay[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadData = async () => {
    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const res = await fetch(`/api/admin/attendance?period=${period}`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data?.error || '근태 조회 실패')
      return
    }

    setUsers(data.users || [])
    setDays(data.days || [])
    if (!selectedUserId && data.users?.[0]?.id) {
      setSelectedUserId(data.users[0].id)
    }
  }

  useEffect(() => {
    void loadData()
  }, [period])

  const selectedDays = useMemo(() => days.filter((day) => day.user_id === selectedUserId), [days, selectedUserId])

  const setAttendance = async (attendanceStatus: 'present' | 'late' | 'vacation' | 'early_leave') => {
    setMessage('')
    setError('')

    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session?.access_token || !selectedUserId) return

    const res = await fetch('/api/admin/attendance/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: session.access_token,
        userId: selectedUserId,
        workDate: selectedDate,
        attendanceStatus
      })
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data?.error || '근태 등록 실패')
      return
    }

    setMessage('근태가 등록되었습니다.')
    await loadData()
  }

  return (
    <AuthGuard requireAdmin>
      <AppShell title="근태 관리" subtitle="직원을 선택해 출근, 지각, 휴가, 조퇴를 기록할 수 있습니다.">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className={`button ${period === 'day' ? '' : 'secondary'}`} onClick={() => setPeriod('day')}>일별</button>
          <button className={`button ${period === 'week' ? '' : 'secondary'}`} onClick={() => setPeriod('week')}>주별</button>
          <button className={`button ${period === 'month' ? '' : 'secondary'}`} onClick={() => setPeriod('month')}>월별</button>
        </div>

        <div className="grid grid-2">
          <div className="panel">
            <div className="card-title">직원 목록</div>
            <div className="list" style={{ marginTop: 16 }}>
              {users.map((user) => (
                <button
                  key={user.id}
                  className="button secondary"
                  style={{
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    borderColor: selectedUserId === user.id ? '#06b6d4' : undefined
                  }}
                  onClick={() => setSelectedUserId(user.id)}
                >
                  {user.name} · {user.role_type}
                </button>
              ))}
            </div>
          </div>

          <div className="panel stack">
            <div className="row-between">
              <div className="card-title">근태 등록</div>
              <input className="input" style={{ maxWidth: 180 }} type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>
            <div className="grid grid-2">
              <button className="button success" onClick={() => setAttendance('present')}>출근</button>
              <button className="button" style={{ background: '#f59e0b' }} onClick={() => setAttendance('late')}>지각</button>
              <button className="button" style={{ background: '#8b5cf6' }} onClick={() => setAttendance('vacation')}>휴가</button>
              <button className="button danger" onClick={() => setAttendance('early_leave')}>조퇴</button>
            </div>

            <div className="panel">
              <div className="card-title">선택 직원 최근 기록</div>
              <div className="list" style={{ marginTop: 16 }}>
                {selectedDays.length === 0 ? (
                  <div className="muted">기록이 없습니다.</div>
                ) : (
                  selectedDays.map((day) => (
                    <div className="list-item" key={day.id}>
                      <div>{day.work_date}</div>
                      <div className="small muted">{day.attendance_status}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {message ? <div className="message-success small">{message}</div> : null}
            {error ? <div className="message-error small">{error}</div> : null}
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  )
}

