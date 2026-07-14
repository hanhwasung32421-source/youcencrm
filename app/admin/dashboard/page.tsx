'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'
import { BarChartCard } from '@/components/bar-chart-card'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type Stats = {
  todayRegisteredCount: number
  unknownIpCount: number
  period?: {
    startDate: string
    endDate: string
  }
  latest: Array<{
    id: string
    title: string | null
    stock_name: string
    content_type: 'longform' | 'shortform'
    view_count: number | null
    published_at: string | null
    created_at: string | null
    duration_seconds: number | null
    primary_owner_user_id: string | null
    youtube_url: string | null
    owner_name?: string
  }>
  charts: {
    viewByLatest: Array<{ label: string; value: number }>
    durationByLatest: Array<{ label: string; value: number }>
    dailyRegistrations: Array<{ label: string; value: number }>
    contentTypes: Array<{ label: string; value: number }>
    employeeTodayCounts: Array<{ label: string; value: number }>
    employeePeriodCounts: Array<{ label: string; value: number }>
    employeeTotalDurations: Array<{ label: string; value: number }>
  }
  employeeEfficiency: Array<{
    userId: string
    name: string
    todayCount: number
    periodCount: number
    totalDurationSeconds: number
    totalViews: number
  }>
}

export default function AdminDashboardPage() {
  const year = useMemo(() => new Date().getFullYear(), [])
  const [startDate, setStartDate] = useState(`${year}-01-01`)
  const [endDate, setEndDate] = useState(`${year}-12-31`)
  const [stats, setStats] = useState<Stats>({
    todayRegisteredCount: 0,
    unknownIpCount: 0,
    latest: [],
    charts: {
      viewByLatest: [],
      durationByLatest: [],
      dailyRegistrations: [],
      contentTypes: [],
      employeeTodayCounts: [],
      employeePeriodCounts: [],
      employeeTotalDurations: []
    },
    employeeEfficiency: []
  })

  const formatDate = (value: string | null) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString('ko-KR')
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds || seconds <= 0) return '-'
    const hour = Math.floor(seconds / 3600)
    const minute = Math.floor((seconds % 3600) / 60)
    const second = seconds % 60
    if (hour > 0) return `${hour}시간 ${minute}분 ${second}초`
    if (minute > 0) return `${minute}분 ${second}초`
    return `${second}초`
  }

  const load = async (nextStartDate = startDate, nextEndDate = endDate) => {
    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const qs = new URLSearchParams({ startDate: nextStartDate, endDate: nextEndDate }).toString()
    const res = await fetch(`/api/dashboard/admin?${qs}`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    if (!res.ok) return
    const data = (await res.json()) as Stats
    setStats(data)
    if (data.period?.startDate) setStartDate(data.period.startDate)
    if (data.period?.endDate) setEndDate(data.period.endDate)
  }

  useEffect(() => {
    void load(`${year}-01-01`, `${year}-12-31`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyPeriod = async () => {
    await load(startDate, endDate)
  }

  const periodLabel = `${startDate} ~ ${endDate}`

  return (
    <AuthGuard requireAdmin>
      <AppShell title="관리자 대시보드" subtitle="직급 관리, 근태 관리와 전체 통계를 확인합니다.">
        <div className="grid grid-4">
          <div className="metric-card">
            <div className="card-title">오늘 CRM 등록</div>
            <div className="card-value">{stats.todayRegisteredCount}</div>
          </div>
          <div className="metric-card">
            <div className="card-title">근태 관리</div>
            <div className="card-value">
              <Link className="link" href="/admin/attendance">
                바로 가기
              </Link>
            </div>
          </div>
          <div className="metric-card">
            <div className="card-title">직급 관리</div>
            <div className="card-value">
              <Link className="link" href="/admin/users">
                바로 가기
              </Link>
            </div>
          </div>
          <div className="metric-card">
            <div className="card-title">미분류 IP 로그인</div>
            <div className="card-value">{stats.unknownIpCount}</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">직원별 업무 효율 표</div>
              <p className="panel-subtitle">기간: {periodLabel} · 오늘 등록, 기간 등록, 업로드 시간, 조회수를 표로 확인합니다.</p>
            </div>
            <div className="toolbar">
              <input
                className="input"
                type="date"
                style={{ maxWidth: 160 }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <input
                className="input"
                type="date"
                style={{ maxWidth: 160 }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <button className="button secondary" onClick={applyPeriod}>
                기간 적용
              </button>
            </div>
          </div>

          <div className="data-table" style={{ marginTop: 16 }}>
            <div className="data-table-header">
              <div>이름</div>
              <div className="data-right">오늘</div>
              <div className="data-right">기간</div>
              <div className="data-right">업로드시간</div>
              <div className="data-right">조회수</div>
            </div>
            {stats.employeeEfficiency.length === 0 ? (
              <div className="data-table-row">
                <div className="muted">데이터 없음</div>
                <div />
                <div />
                <div />
                <div />
              </div>
            ) : (
              stats.employeeEfficiency.map((item) => (
                <div className="data-table-row" key={item.userId}>
                  <div>{item.name}</div>
                  <div className="data-right">{item.todayCount.toLocaleString('ko-KR')}</div>
                  <div className="data-right">{item.periodCount.toLocaleString('ko-KR')}</div>
                  <div className="data-right">{formatDuration(item.totalDurationSeconds)}</div>
                  <div className="data-right">{item.totalViews.toLocaleString('ko-KR')}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid grid-2">
          <BarChartCard title="직원별 오늘 등록 수" subtitle="오늘 기준입니다." items={stats.charts.employeeTodayCounts} tone="blue" />
          <BarChartCard title="직원별 기간 등록 수" subtitle={`기간: ${periodLabel}`} items={stats.charts.employeePeriodCounts} tone="violet" />
          <BarChartCard
            title="직원별 총 업로드 시간"
            subtitle={`기간: ${periodLabel}`}
            items={stats.charts.employeeTotalDurations.map((item) => ({ ...item, displayValue: formatDuration(item.value) }))}
            tone="green"
          />
          <BarChartCard title="최근 7일 전체 등록 수" subtitle="팀 전체 영상 등록 추이입니다." items={stats.charts.dailyRegistrations} tone="amber" />
        </div>

        <div className="grid grid-2">
          <BarChartCard
            title="최근 영상 조회수"
            subtitle="유튜브 제목이 아니라 담당자 이름 기준으로 합산합니다."
            items={stats.charts.viewByLatest}
            tone="blue"
          />
          <BarChartCard
            title="최근 영상 길이"
            subtitle="유튜브 제목이 아니라 담당자 이름 기준으로 합산합니다."
            items={stats.charts.durationByLatest.map((item) => ({ ...item, displayValue: formatDuration(item.value) }))}
            tone="green"
          />
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">최근 등록 영상</div>
              <p className="panel-subtitle">담당자 이름을 포함해서 확인합니다.</p>
            </div>
          </div>
          <div className="list" style={{ marginTop: 16 }}>
            {stats.latest.length === 0 ? (
              <div className="empty-state">아직 등록된 영상이 없습니다.</div>
            ) : (
              stats.latest.map((item) => (
                <div className="list-item" key={item.id}>
                  <div className="row-between">
                    <div>{item.title || '제목 없음'}</div>
                    {item.youtube_url ? (
                      <a className="button secondary" href={item.youtube_url} target="_blank" rel="noreferrer">
                        바로가기
                      </a>
                    ) : null}
                  </div>
                  <div className="small muted">담당자: {item.owner_name || '이름 없음'}</div>
                  <div className="small muted">
                    {item.stock_name} · {item.content_type === 'longform' ? '롱폼' : '숏폼'} · 조회수 {item.view_count ?? 0}
                  </div>
                  <div className="small muted">업로드일자 {formatDate(item.published_at || item.created_at)}</div>
                  <div className="small muted">영상 길이 {formatDuration(item.duration_seconds)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  )
}

