'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/v2/app-shell'
import { AdminOnly } from '@/components/v2/auth-guard'
import { SampleBanner } from '@/components/v2/sample-banner'
import { Sparkline } from '@/components/v2/sparkline'
import { BarChartCard } from '@/components/bar-chart-card'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson } from '@/lib/session/authed-fetch'
import { formatKstTime, formatYmdLabel } from '@/lib/v2/dates'
import type { AttendanceLite, WorkloadPayload } from '@/lib/v2/types'

const ATTENDANCE_LABELS: Record<string, string> = {
  present: '출근',
  late: '지각',
  vacation: '휴가',
  early_leave: '조퇴',
  review_needed: '확인 필요',
  not_started: '미출근'
}

function attendanceTone(att: AttendanceLite | null) {
  if (!att || !att.check_in_at) return 'off'
  if (att.attendance_status === 'late' || att.attendance_status === 'review_needed' || att.attendance_status === 'early_leave') return 'warn'
  return 'on'
}

function attendanceText(att: AttendanceLite | null) {
  if (!att) return '기록 없음'
  const status = ATTENDANCE_LABELS[att.attendance_status || ''] || att.attendance_status || '-'
  const inAt = att.check_in_at ? formatKstTime(att.check_in_at) : '-'
  const outAt = att.check_out_at ? ` ~ ${formatKstTime(att.check_out_at)}` : ''
  return `${status} · ${inAt}${outAt}`
}

export default function WorkloadPage() {
  return (
    <AdminOnly>
      <WorkloadContent />
    </AdminOnly>
  )
}

function WorkloadContent() {
  const { toast, showError } = useToast()
  const [payload, setPayload] = useState<WorkloadPayload>({ rows: [], today: '', days: [] })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { ok, data } = await authedFetchJson<WorkloadPayload & { error?: string }>('/api/v2/workload')
      if (cancelled) return
      setLoaded(true)
      if (!ok) {
        showError(data?.error || '워크로드 조회 실패')
        return
      }
      setPayload(data)
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows = payload.rows
  const targetTotal = rows.reduce((sum, r) => sum + r.target, 0)
  const doneTotal = rows.reduce((sum, r) => sum + r.doneToday, 0)
  const inProgressTotal = rows.reduce((sum, r) => sum + r.inProgress, 0)
  const lateTotal = rows.reduce((sum, r) => sum + r.late, 0)
  const presentCount = rows.filter((r) => r.attendance?.check_in_at).length
  const achievement = targetTotal > 0 ? Math.round((doneTotal / targetTotal) * 100) : 0

  const chartItems = [...rows]
    .sort((a, b) => b.doneToday - a.doneToday)
    .map((r) => ({ label: r.name, value: r.doneToday, displayValue: `${r.doneToday} / ${r.target}` }))

  return (
    <>
      <PageHeader
        title="담당자 워크로드"
        subtitle={`${payload.today ? formatYmdLabel(payload.today) : '오늘'} 기준 담당자별 목표·완료·진행·지연과 근태, 최근 7일 등록 추이입니다. 목표는 설정 › 유튜브 API 연동에서 바꿉니다.`}
        actions={
          <Link className="button secondary" href="/v2/settings/youtube-api">
            일일 목표 설정
          </Link>
        }
      />
      <Toast toast={toast} />
      <SampleBanner show={payload.sample} />

      <div className="v2-kpi-strip">
        <div className={`v2-kpi ${achievement >= 100 ? 'good' : achievement >= 60 ? 'warn' : ''}`}>
          <div className="v2-kpi-label">팀 완료 / 목표</div>
          <div className="v2-kpi-value">
            {doneTotal}
            <span className="unit">/ {targetTotal}</span>
          </div>
          <div className="v2-kpi-meta">달성률 {achievement}%</div>
        </div>
        <div className="v2-kpi">
          <div className="v2-kpi-label">진행 중</div>
          <div className="v2-kpi-value">
            {inProgressTotal}
            <span className="unit">건</span>
          </div>
          <div className="v2-kpi-meta">촬영 · 편집 · 업로드 대기</div>
        </div>
        <div className={`v2-kpi ${lateTotal > 0 ? 'bad' : 'good'}`}>
          <div className="v2-kpi-label">지연</div>
          <div className="v2-kpi-value">
            {lateTotal}
            <span className="unit">건</span>
          </div>
          <div className="v2-kpi-meta">마감 지난 미완료</div>
        </div>
        <div className="v2-kpi">
          <div className="v2-kpi-label">출근</div>
          <div className="v2-kpi-value">
            {presentCount}
            <span className="unit">/ {rows.length}명</span>
          </div>
          <div className="v2-kpi-meta">오늘 근태 기록 기준</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">담당자별 현황</div>
            <p className="panel-subtitle">완료는 오늘 등록된 영상 수, 진행/지연은 제작 보드 카드 기준입니다.</p>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="empty-state">{loaded ? '활성 직원이 없습니다.' : ''}</div>
        ) : (
          <div className="data-table v2-table" style={{ '--cols': '1.1fr 0.9fr 0.55fr 0.55fr 0.55fr 1.3fr 1fr', '--minw': '860px' } as React.CSSProperties}>
            <div className="data-table-header">
              <div>담당자</div>
              <div>오늘 완료 / 목표</div>
              <div className="data-right">기획</div>
              <div className="data-right">진행</div>
              <div className="data-right">지연</div>
              <div>근태</div>
              <div>7일 추이</div>
            </div>
            {rows.map((r) => {
              const ratio = r.target > 0 ? Math.min(100, Math.round((r.doneToday / r.target) * 100)) : 0
              const tone = ratio >= 100 ? 'full' : ratio < 40 ? 'low' : ''
              return (
                <div className="data-table-row" key={r.userId}>
                  <div style={{ fontWeight: 700 }}>{r.name}</div>
                  <div>
                    <div className="v2-minibar-row" style={{ gridTemplateColumns: 'minmax(0,1fr) 56px' }}>
                      <div className="v2-minibar-track">
                        <div className={`v2-minibar-fill ${tone}`} style={{ width: `${ratio}%` }} />
                      </div>
                      <span className="v2-minibar-value">
                        {r.doneToday}/{r.target}
                      </span>
                    </div>
                  </div>
                  <div className="data-right">{r.planning}</div>
                  <div className="data-right">{r.inProgress}</div>
                  <div className="data-right" style={{ color: r.late > 0 ? '#f87171' : undefined }}>
                    {r.late}
                  </div>
                  <div className="small">
                    <span className={`v2-status-dot ${attendanceTone(r.attendance)}`} />
                    {attendanceText(r.attendance)}
                  </div>
                  <div>
                    <Sparkline points={r.spark.map((p) => p.count)} target={r.target} label={`${r.name} 최근 7일 등록 추이`} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <BarChartCard title="오늘 완료 순위" subtitle="등록 영상 수 기준 · 값은 완료 / 목표" items={chartItems} tone="amber" />
    </>
  )
}
