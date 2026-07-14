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
  check_in_at: string | null
  check_out_at: string | null
}

type AttendanceEvent = {
  id: string
  attendance_day_id: string
  event_type: string
  occurred_at: string
  source: string
  note: string | null
}

type TodayStatusBuckets = {
  present: string[]
  late: string[]
  vacation: string[]
  early_leave: string[]
  not_registered: string[]
}

export default function AdminAttendancePage() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day')
  const [users, setUsers] = useState<UserItem[]>([])
  const [days, setDays] = useState<AttendanceDay[]>([])
  const [events, setEvents] = useState<AttendanceEvent[]>([])
  const [todayStatusBuckets, setTodayStatusBuckets] = useState<TodayStatusBuckets>({
    present: [],
    late: [],
    vacation: [],
    early_leave: [],
    not_registered: []
  })
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
    setEvents(data.events || [])
    setTodayStatusBuckets(
      data.todayStatusBuckets || {
        present: [],
        late: [],
        vacation: [],
        early_leave: [],
        not_registered: []
      }
    )
    if (!selectedUserId && data.users?.[0]?.id) {
      setSelectedUserId(data.users[0].id)
    }
  }

  useEffect(() => {
    void loadData()
  }, [period])

  const selectedDays = useMemo(() => days.filter((day) => day.user_id === selectedUserId), [days, selectedUserId])
  const selectedEvents = useMemo(() => {
    const selectedDayIds = new Set(selectedDays.map((day) => day.id))
    return events.filter((event) => selectedDayIds.has(event.attendance_day_id))
  }, [events, selectedDays])

  const summary = useMemo(() => {
    const base = { present: 0, late: 0, vacation: 0, early_leave: 0, not_started: 0 }
    for (const day of selectedDays) {
      if (day.attendance_status in base) {
        base[day.attendance_status as keyof typeof base] += 1
      }
    }
    return base
  }, [selectedDays])

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

  const formatDateTime = (value: string | null) => {
    if (!value) return '-'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return `${d.toLocaleDateString('ko-KR')} ${d.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })}`
  }

  return (
    <AuthGuard requireAdmin>
      <AppShell title="근태 관리" subtitle="직원을 선택해 출근, 지각, 휴가, 조퇴를 기록할 수 있습니다.">
        <div className="toolbar">
          <button className={`button ${period === 'day' ? '' : 'secondary'}`} onClick={() => setPeriod('day')}>일별</button>
          <button className={`button ${period === 'week' ? '' : 'secondary'}`} onClick={() => setPeriod('week')}>주별</button>
          <button className={`button ${period === 'month' ? '' : 'secondary'}`} onClick={() => setPeriod('month')}>월별</button>
        </div>

        <div className="grid grid-4">
          <div className="metric-card">
            <div className="card-title">오늘 출근</div>
            <div className="card-meta">{todayStatusBuckets.present.join(', ') || '없음'}</div>
          </div>
          <div className="metric-card">
            <div className="card-title">오늘 지각</div>
            <div className="card-meta">{todayStatusBuckets.late.join(', ') || '없음'}</div>
          </div>
          <div className="metric-card">
            <div className="card-title">오늘 휴가</div>
            <div className="card-meta">{todayStatusBuckets.vacation.join(', ') || '없음'}</div>
          </div>
          <div className="metric-card">
            <div className="card-title">오늘 조퇴</div>
            <div className="card-meta">{todayStatusBuckets.early_leave.join(', ') || '없음'}</div>
          </div>
        </div>

        <div className="panel soft">
          <div className="panel-title">오늘 등록안됨</div>
          <div className="panel-subtitle" style={{ marginTop: 8 }}>
            {todayStatusBuckets.not_registered.join(', ') || '없음'}
          </div>
        </div>

        <div className="grid grid-2">
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">직원 목록</div>
                <p className="panel-subtitle">대상 직원을 선택하면 우측 기록 문서가 활성화됩니다.</p>
              </div>
            </div>
            <div className="list" style={{ marginTop: 16 }}>
              {users.map((user) => (
                <button
                  key={user.id}
                  className={`button secondary ${selectedUserId === user.id ? 'active' : ''}`}
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
              <div>
                <div className="panel-title">근태 등록</div>
                <div className="panel-subtitle">선택한 날짜 기준으로 상태를 바로 기록합니다.</div>
              </div>
              <input className="input" style={{ maxWidth: 180 }} type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>
            <div className="grid grid-2">
              <button className="button success" onClick={() => setAttendance('present')}>출근</button>
              <button className="button warning" onClick={() => setAttendance('late')}>지각</button>
              <button className="button violet" onClick={() => setAttendance('vacation')}>휴가</button>
              <button className="button danger" onClick={() => setAttendance('early_leave')}>조퇴</button>
            </div>

            {period !== 'day' ? (
              <div className="grid grid-4">
                <div className="metric-card">
                  <div className="card-title">{period === 'week' ? '주간 출근' : '월간 출근'}</div>
                  <div className="card-value">{summary.present}</div>
                </div>
                <div className="metric-card">
                  <div className="card-title">{period === 'week' ? '주간 지각' : '월간 지각'}</div>
                  <div className="card-value">{summary.late}</div>
                </div>
                <div className="metric-card">
                  <div className="card-title">{period === 'week' ? '주간 휴가' : '월간 휴가'}</div>
                  <div className="card-value">{summary.vacation}</div>
                </div>
                <div className="metric-card">
                  <div className="card-title">{period === 'week' ? '주간 조퇴' : '월간 조퇴'}</div>
                  <div className="card-value">{summary.early_leave}</div>
                </div>
              </div>
            ) : null}

            <div className="panel soft">
              <div className="panel-header">
                <div>
                  <div className="panel-title">선택 직원 최근 기록</div>
                  <p className="panel-subtitle">날짜와 버튼을 누른 시간이 함께 기록됩니다.</p>
                </div>
              </div>
              <div className="list" style={{ marginTop: 16 }}>
                {selectedDays.length === 0 ? (
                  <div className="empty-state">기록이 없습니다.</div>
                ) : (
                  selectedDays.map((day) => (
                    <div className="list-item" key={day.id}>
                      <div>{day.work_date}</div>
                      <div className="small muted">상태: {day.attendance_status}</div>
                      <div className="small muted">출근 시간: {formatDateTime(day.check_in_at)}</div>
                      <div className="small muted">퇴근 시간: {formatDateTime(day.check_out_at)}</div>
                      <div className="small muted">
                        기록 시간:
                        {selectedEvents
                          .filter((event) => event.attendance_day_id === day.id)
                          .map((event) => `${event.event_type}(${formatDateTime(event.occurred_at)})`)
                          .join(', ') || ' -'}
                      </div>
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
