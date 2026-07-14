'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'
import { BarChartCard } from '@/components/bar-chart-card'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type Stats = {
  todayRegisteredCount: number
  unknownIpCount: number
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

  useEffect(() => {
    const run = async () => {
      const supabase = createSupabaseBrowserClient()
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch('/api/dashboard/admin', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (!res.ok) return
      setStats((await res.json()) as Stats)
    }
    void run()
  }, [])

  return (
    <AuthGuard requireAdmin>
      <AppShell title="관리자 대시보드" subtitle="직급 관리, 근태 관리, 유튜브 계정 관리와 전체 통계를 확인합니다.">
        <div className="grid grid-4">
          <div className="metric-card">
            <div className="card-title">오늘 CRM 등록</div>
            <div className="card-value">{stats.todayRegisteredCount}</div>
          </div>
          <div className="metric-card">
            <div className="card-title">근태 관리</div>
            <div className="card-value"><Link className="link" href="/admin/attendance">바로 가기</Link></div>
          </div>
          <div className="metric-card">
            <div className="card-title">직급 관리</div>
            <div className="card-value"><Link className="link" href="/admin/users">바로 가기</Link></div>
          </div>
          <div className="metric-card">
            <div className="card-title">미분류 IP 로그인</div>
            <div className="card-value">{stats.unknownIpCount}</div>
          </div>
        </div>

        <div className="grid grid-2">
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">유튜브 계정</div>
                <p className="panel-subtitle">관리자 페이지에서 채널별 API 키와 이름을 계속 추가할 수 있습니다.</p>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <Link className="button secondary" href="/admin/youtube-accounts">유튜브 계정 관리</Link>
            </div>
          </div>
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">최근 등록 영상</div>
                <p className="panel-subtitle">전체 팀 기준으로 최신 등록 영상의 조회수, 업로드일자, 길이를 확인합니다.</p>
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
        </div>

        <div className="grid grid-2">
          <BarChartCard title="최근 영상 조회수" subtitle="전체 최신 등록 영상 기준 조회수 비교입니다." items={stats.charts.viewByLatest} tone="blue" />
          <BarChartCard
            title="최근 영상 길이"
            subtitle="전체 최신 등록 영상의 길이 비교입니다."
            items={stats.charts.durationByLatest.map((item) => ({ ...item, displayValue: formatDuration(item.value) }))}
            tone="green"
          />
          <BarChartCard title="최근 7일 등록 수" subtitle="팀 전체 영상 등록 추이입니다." items={stats.charts.dailyRegistrations} tone="violet" />
          <BarChartCard title="콘텐츠 형식 분포" subtitle="전체 등록 영상의 형식별 개수입니다." items={stats.charts.contentTypes} tone="amber" />
        </div>

        <div className="grid grid-2">
          <BarChartCard
            title="직원별 오늘 등록 수"
            subtitle="오늘 누가 몇 개의 영상을 올렸는지 확인합니다."
            items={stats.charts.employeeTodayCounts}
            tone="blue"
          />
          <BarChartCard
            title="직원별 최근 7일 등록 수"
            subtitle="최근 기간 동안의 등록량 비교입니다."
            items={stats.charts.employeePeriodCounts}
            tone="violet"
          />
          <BarChartCard
            title="직원별 총 업로드 시간"
            subtitle="누적 영상 길이를 기준으로 업무량을 봅니다."
            items={stats.charts.employeeTotalDurations.map((item) => ({ ...item, displayValue: formatDuration(item.value) }))}
            tone="green"
          />
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">직원별 업무 효율 표</div>
              <p className="panel-subtitle">관리자가 오늘 등록 수, 최근 기간 등록 수, 누적 업로드 시간, 누적 조회수를 함께 확인합니다.</p>
            </div>
          </div>
          <div className="list" style={{ marginTop: 16 }}>
            {stats.employeeEfficiency.length === 0 ? (
              <div className="empty-state">직원별 집계 데이터가 없습니다.</div>
            ) : (
              stats.employeeEfficiency.map((item) => (
                <div className="list-item" key={item.userId}>
                  <div className="row-between">
                    <div>
                      <div>{item.name}</div>
                      <div className="small muted">오늘 등록 {item.todayCount}개 · 최근 7일 등록 {item.periodCount}개</div>
                    </div>
                    <div className="small muted">누적 조회수 {item.totalViews.toLocaleString('ko-KR')}</div>
                  </div>
                  <div className="small muted" style={{ marginTop: 8 }}>
                    총 업로드 시간 {formatDuration(item.totalDurationSeconds)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  )
}
