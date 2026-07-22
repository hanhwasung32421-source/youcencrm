'use client'

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { formatWorkedHms } from '@/lib/attendance'

type UserItem = {
  id: string
  name: string
  role_type: string
  employment_status: string
}

type AttendanceRow = {
  userId: string
  name: string
  roleType: string
  attendanceStatus: string
  checkInAt: string | null
  checkOutAt: string | null
  workedSeconds: number
}

export default function AdminAttendancePage() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day')
  const [users, setUsers] = useState<UserItem[]>([])
  const [rows, setRows] = useState<AttendanceRow[]>([])
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
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data?.error || '근태 조회 실패')
      return
    }
    setUsers(data.users || [])
    setRows(data.rows || [])
    if (!selectedUserId && data.users?.[0]?.id) {
      setSelectedUserId(data.users[0].id)
    }
  }

  useEffect(() => {
    void loadData()
  }, [period])

  const setAttendance = async (attendanceStatus: 'present' | 'late' | 'vacation' | 'early_leave' | 'checkout') => {
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
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data?.error || '근태 등록 실패')
      return
    }
    setMessage('근태가 반영되었습니다.')
    await loadData()
  }

  const formatDateTime = (value: string | null) => {
    if (!value) return '-'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const timeLabel =
    period === 'day'
      ? '오늘 출근시간 / 퇴근시간 / 총 업무시간'
      : period === 'week'
        ? '이번 주 첫 출근 / 마지막 퇴근 / 총 업무시간'
        : '이번 달 첫 출근 / 마지막 퇴근 / 총 업무시간'

  return (
    <AuthGuard requireAdmin>
      <AppShell title="근태 관리" subtitle="직원별 출근시간, 퇴근시간, 총 업무시간을 한눈에 확인합니다.">
        <div className="toolbar">
          <button className={`button ${period === 'day' ? '' : 'secondary'}`} onClick={() => setPeriod('day')}>일별</button>
          <button className={`button ${period === 'week' ? '' : 'secondary'}`} onClick={() => setPeriod('week')}>주별</button>
          <button className={`button ${period === 'month' ? '' : 'secondary'}`} onClick={() => setPeriod('month')}>월별</button>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">근태 테이블</div>
              <p className="panel-subtitle">{timeLabel}</p>
            </div>
          </div>

          <div className="data-table" style={{ marginTop: 16 }}>
            <div className="data-table-header" style={{ gridTemplateColumns: '1.2fr 0.9fr 0.9fr 1fr' }}>
              <div>직원</div>
              <div className="data-right">출근시간</div>
              <div className="data-right">퇴근시간</div>
              <div className="data-right">총 업무시간</div>
            </div>
            {rows.length === 0 ? (
              <div className="data-table-row" style={{ gridTemplateColumns: '1.2fr 0.9fr 0.9fr 1fr' }}>
                <div className="muted">데이터 없음</div>
                <div />
                <div />
                <div />
              </div>
            ) : (
              rows.map((row) => (
                <div className="data-table-row" key={row.userId} style={{ gridTemplateColumns: '1.2fr 0.9fr 0.9fr 1fr' }}>
                  <div>
                    <div>{row.name}</div>
                    <div className="small muted">{row.roleType} · {row.attendanceStatus}</div>
                  </div>
                  <div className="data-right">{formatDateTime(row.checkInAt)}</div>
                  <div className="data-right">{formatDateTime(row.checkOutAt)}</div>
                  <div className="data-right">{formatWorkedHms(row.workedSeconds)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel stack">
          <div className="row-between">
            <div>
              <div className="panel-title">근태 등록</div>
              <div className="panel-subtitle">직원을 고르고 출근, 지각, 조퇴, 휴가, 퇴근을 바로 반영합니다.</div>
            </div>
            <div className="toolbar">
              <select className="select" style={{ minWidth: 220 }} value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                <option value="">직원을 선택하세요</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {user.role_type}
                  </option>
                ))}
              </select>
              <input className="input" style={{ maxWidth: 180 }} type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-2">
            <button className="button success" onClick={() => setAttendance('present')}>출근</button>
            <button className="button warning" onClick={() => setAttendance('late')}>지각</button>
            <button className="button danger" onClick={() => setAttendance('early_leave')}>조퇴</button>
            <button className="button violet" onClick={() => setAttendance('vacation')}>휴가</button>
            <button className="button secondary" onClick={() => setAttendance('checkout')}>퇴근</button>
          </div>

          {message ? <div className="message-success small">{message}</div> : null}
          {error ? <div className="message-error small">{error}</div> : null}
        </div>
      </AppShell>
    </AuthGuard>
  )
}

