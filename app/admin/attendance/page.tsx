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
  weekEntries: Array<{ ymd: string; label: string; checkInAt: string | null; checkOutAt: string | null }>
  monthEntries: Array<{ dayNumber: number; status: string }>
}

export default function AdminAttendancePage() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day')
  const [users, setUsers] = useState<UserItem[]>([])
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [weekDays, setWeekDays] = useState<Array<{ ymd: string; label: string }>>([])
  const [monthDays, setMonthDays] = useState<number[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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
    setWeekDays(data.weekDays || [])
    setMonthDays(data.monthDays || [])
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
    setSaving(true)
    try {
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
    } finally {
      setSaving(false)
    }
  }

  const formatTime = (value: string | null) => {
    if (!value) return '-'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <AuthGuard requireAdmin>
      <AppShell title="근태 관리" subtitle="일별, 주별, 월별로 직원 근태를 확인하고 바로 수정할 수 있습니다.">
        {saving ? (
          <div className="loading-overlay">
            <div className="loading-modal">
              <div className="loading-spinner" />
              <div className="loading-text">적용중입니다...</div>
            </div>
          </div>
        ) : null}

        <div className="toolbar">
          <button className={`button ${period === 'day' ? '' : 'secondary'}`} onClick={() => setPeriod('day')}>일별</button>
          <button className={`button ${period === 'week' ? '' : 'secondary'}`} onClick={() => setPeriod('week')}>주별</button>
          <button className={`button ${period === 'month' ? '' : 'secondary'}`} onClick={() => setPeriod('month')}>월별</button>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">근태 테이블</div>
            </div>
          </div>

          {period === 'day' ? (
            <div className="data-table attendance-day-table attendance-table-center" style={{ marginTop: 16 }}>
              <div className="data-table-header" style={{ gridTemplateColumns: '1.1fr 0.8fr 0.9fr 0.9fr 1fr' }}>
                <div>직원</div>
                <div className="dashboard-header-center">상태</div>
                <div className="data-right">출근시간</div>
                <div className="data-right">퇴근시간</div>
                <div className="data-right">총 업무시간</div>
              </div>
              {rows.length === 0 ? (
                <div className="data-table-row" style={{ gridTemplateColumns: '1.1fr 0.8fr 0.9fr 0.9fr 1fr' }}>
                  <div className="muted">데이터 없음</div>
                  <div />
                  <div />
                  <div />
                  <div />
                </div>
              ) : (
                rows.map((row) => (
                  <div className="data-table-row" key={row.userId} style={{ gridTemplateColumns: '1.1fr 0.8fr 0.9fr 0.9fr 1fr' }}>
                    <div>{row.name}</div>
                    <div className="dashboard-header-center">{row.attendanceStatus}</div>
                    <div className="data-right">{formatTime(row.checkInAt)}</div>
                    <div className="data-right">{formatTime(row.checkOutAt)}</div>
                    <div className="data-right">{formatWorkedHms(row.workedSeconds)}</div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {period === 'week' ? (
            <div className="data-table attendance-week-table attendance-table-center" style={{ marginTop: 16 }}>
              <div className="data-table-header" style={{ gridTemplateColumns: `1fr repeat(${weekDays.length}, minmax(92px, 1fr))` }}>
                <div>직원</div>
                {weekDays.map((day) => (
                  <div className="dashboard-header-center" key={day.ymd}>
                    {day.label}
                  </div>
                ))}
              </div>
              {rows.map((row) => (
                <div className="data-table-row" key={row.userId} style={{ gridTemplateColumns: `1fr repeat(${weekDays.length}, minmax(92px, 1fr))` }}>
                  <div>{row.name}</div>
                  {row.weekEntries.map((entry) => (
                    <div className="attendance-compact-cell" key={entry.ymd}>
                      <div>{formatTime(entry.checkInAt)}</div>
                      <div className="muted">{formatTime(entry.checkOutAt)}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : null}

          {period === 'month' ? (
            <div className="attendance-month-board attendance-table-center" style={{ marginTop: 16 }}>
              <div className="attendance-month-header">
                <div>이름</div>
                <div className="attendance-month-days">
                  {monthDays.map((day) => (
                    <div className="attendance-month-day" key={day}>{day}</div>
                  ))}
                </div>
              </div>
              {rows.map((row) => (
                <div className="attendance-month-row" key={row.userId}>
                  <div className="attendance-month-name">{row.name}</div>
                  <div className="attendance-month-days">
                    {row.monthEntries.map((entry) => (
                      <div className="attendance-month-cell" key={`${row.userId}-${entry.dayNumber}`}>
                        {entry.status}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="panel stack">
          <div className="row-between">
            <div>
              <div className="panel-title">근태 등록</div>
            </div>
            <div className="toolbar attendance-register-row">
              <select className="select attendance-compact-select" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                <option value="">직원 선택</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {user.role_type}
                  </option>
                ))}
              </select>
              <input className="input attendance-compact-date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
              <button className="button success attendance-mini-button" onClick={() => setAttendance('present')}>출근</button>
              <button className="button warning attendance-mini-button" onClick={() => setAttendance('late')}>지각</button>
              <button className="button danger attendance-mini-button" onClick={() => setAttendance('early_leave')}>조퇴</button>
              <button className="button violet attendance-mini-button" onClick={() => setAttendance('vacation')}>휴가</button>
              <button className="button secondary attendance-mini-button" onClick={() => setAttendance('checkout')}>퇴근</button>
            </div>
          </div>

          {message ? <div className="message-success small">{message}</div> : null}
          {error ? <div className="message-error small">{error}</div> : null}
        </div>
      </AppShell>
    </AuthGuard>
  )
}
