'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/app-shell'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { formatWorkedHms } from '@/lib/attendance/time'

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
  weekEntries: Array<{ ymd: string; label: string; status: string }>
  monthEntries: Array<{ dayNumber: number; status: string }>
  monthSummary: {
    attendanceCount: number
    lateCount: number
    earlyLeaveCount: number
    vacationCount: number
  }
}

const STATUS_CLASS_MAP: Record<string, string> = {
  출근: 'attendance-status-present',
  지각: 'attendance-status-late',
  퇴근: 'attendance-status-checkout',
  미입력: 'attendance-status-empty',
  휴가: 'attendance-status-empty',
  조퇴: 'attendance-status-early-leave'
}

export default function AdminAttendancePage() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day')
  const [users, setUsers] = useState<UserItem[]>([])
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [weekDays, setWeekDays] = useState<Array<{ ymd: string; label: string }>>([])
  const [monthDays, setMonthDays] = useState<number[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const { toast, showSuccess, showError } = useToast()
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    const { ok, data } = await authedFetchJson<{
      users?: UserItem[]
      rows?: AttendanceRow[]
      weekDays?: Array<{ ymd: string; label: string }>
      monthDays?: number[]
      error?: string
    }>(`/api/admin/attendance?period=${period}`)
    if (!ok) {
      showError(data?.error || '근태 조회 실패')
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

  const ATTENDANCE_ACTION_LABEL: Record<'vacation' | 'early_leave' | 'checkout', string> = {
    vacation: '휴가',
    early_leave: '조퇴',
    checkout: '퇴근'
  }

  const setAttendance = async (attendanceStatus: 'vacation' | 'early_leave' | 'checkout') => {
    if (!selectedUserId) {
      showError('직원을 먼저 선택해 주세요.')
      return
    }

    const selectedUser = users.find((user) => user.id === selectedUserId)
    const confirmed = window.confirm(
      `${selectedUser?.name || '이 직원'}님의 ${selectedDate} 근태를 "${ATTENDANCE_ACTION_LABEL[attendanceStatus]}"(으)로 등록할까요?`
    )
    if (!confirmed) return

    setSaving(true)
    try {
      const { ok, data } = await authedPostJson<{ error?: string }>('/api/admin/attendance/set', {
        userId: selectedUserId,
        workDate: selectedDate,
        attendanceStatus
      })
      if (!ok) {
        showError(data?.error || '근태 등록 실패')
        return
      }
      showSuccess('근태가 반영되었습니다.')
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

  const badgeClass = (status: string) => STATUS_CLASS_MAP[status] || 'attendance-status-empty'

  return (
    <>
      <PageHeader title="근태 관리" subtitle="일별, 주별, 월별로 직원 근태를 빠르게 확인하고 필요한 값만 수정합니다." />
        <Toast toast={toast} />

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
                  <div
                    className="data-table-row"
                    key={row.userId}
                    style={{ gridTemplateColumns: '1.1fr 0.8fr 0.9fr 0.9fr 1fr', cursor: 'pointer' }}
                    title="클릭하면 아래 근태 등록에서 이 직원이 선택됩니다."
                    onClick={() => setSelectedUserId(row.userId)}
                  >
                    <div>{row.name}{selectedUserId === row.userId ? ' ✓' : ''}</div>
                    <div className={`attendance-status-badge ${badgeClass(row.attendanceStatus)}`}>{row.attendanceStatus}</div>
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
                    <div className={`attendance-compact-cell attendance-status-badge ${badgeClass(entry.status)}`} key={entry.ymd}>
                      {entry.status}
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
                <div className="attendance-month-summary-header">합계</div>
              </div>
              {rows.map((row) => (
                <div className="attendance-month-row" key={row.userId}>
                  <div className="attendance-month-name">{row.name}</div>
                  <div className="attendance-month-days">
                    {row.monthEntries.map((entry) => (
                      <div className={`attendance-month-cell ${badgeClass(entry.status)}`} key={`${row.userId}-${entry.dayNumber}`}>
                        {entry.status === '미입력' ? '' : entry.status}
                      </div>
                    ))}
                  </div>
                  <div className="attendance-month-summary">
                    <div>출근 {row.monthSummary.attendanceCount}</div>
                    <div>지각 {row.monthSummary.lateCount}</div>
                    <div>조퇴 {row.monthSummary.earlyLeaveCount}</div>
                    <div>휴가 {row.monthSummary.vacationCount}</div>
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
              <button className="button danger attendance-mini-button" disabled={saving} onClick={() => setAttendance('early_leave')}>조퇴</button>
              <button className="button violet attendance-mini-button" disabled={saving} onClick={() => setAttendance('vacation')}>휴가</button>
              <button className="button secondary attendance-mini-button" disabled={saving} onClick={() => setAttendance('checkout')}>퇴근</button>
            </div>
          </div>
        </div>
    </>
  )
}

