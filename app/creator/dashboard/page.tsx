'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'
import { BarChartCard } from '@/components/bar-chart-card'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type Stats = {
  todayRegisteredCount: number
  latest: Array<{
    id: string
    title: string | null
    stock_name: string
    content_type: 'longform' | 'shortform'
    view_count: number | null
    published_at: string | null
    created_at: string | null
    duration_seconds: number | null
    youtube_url: string | null
  }>
  charts: {
    viewByLatest: Array<{ label: string; value: number }>
    durationByLatest: Array<{ label: string; value: number }>
    dailyRegistrations: Array<{ label: string; value: number }>
    contentTypes: Array<{ label: string; value: number }>
  }
}

export default function CreatorDashboardPage() {
  const [stats, setStats] = useState<Stats>({
    todayRegisteredCount: 0,
    latest: [],
    charts: { viewByLatest: [], durationByLatest: [], dailyRegistrations: [], contentTypes: [] }
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

      const res = await fetch('/api/dashboard/creator', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (!res.ok) return
      setStats((await res.json()) as Stats)
    }
    void run()
  }, [])

  return (
    <AuthGuard>
      <AppShell title="유튜버 대시보드" subtitle="업로드 후 영상 URL을 입력해 통계를 누적합니다.">
        <div className="grid grid-4">
          <div className="metric-card">
            <div className="card-title">오늘 CRM 등록</div>
            <div className="card-value">{stats.todayRegisteredCount}</div>
          </div>
          <div className="metric-card">
            <div className="card-title">영상 등록</div>
            <div className="card-value"><Link className="link" href="/creator/videos">바로 가기</Link></div>
          </div>
          <div className="metric-card">
            <div className="card-title">최근 등록 수</div>
            <div className="card-value">{stats.latest.length}</div>
          </div>
          <div className="metric-card">
            <div className="card-title">통계 반영</div>
            <div className="card-value">자동</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">최근 등록 영상</div>
              <p className="panel-subtitle">최근 입력한 영상의 조회수, 업로드일자, 영상 길이를 빠르게 확인합니다.</p>
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

        <div className="grid grid-2">
          <BarChartCard title="최근 영상 조회수" subtitle="본인이 최근 등록한 영상 기준입니다." items={stats.charts.viewByLatest} tone="blue" />
          <BarChartCard
            title="최근 영상 길이"
            subtitle="영상 길이를 초 단위 기준으로 비교합니다."
            items={stats.charts.durationByLatest.map((item) => ({ ...item, displayValue: formatDuration(item.value) }))}
            tone="green"
          />
          <BarChartCard title="최근 7일 등록 수" subtitle="본인 영상 등록 추이입니다." items={stats.charts.dailyRegistrations} tone="violet" />
          <BarChartCard title="콘텐츠 형식 분포" subtitle="본인 등록 영상의 형식별 개수입니다." items={stats.charts.contentTypes} tone="amber" />
        </div>
      </AppShell>
    </AuthGuard>
  )
}
