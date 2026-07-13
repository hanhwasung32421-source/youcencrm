'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type Stats = {
  todayRegisteredCount: number
  latest: Array<{
    id: string
    title: string | null
    stock_name: string
    content_type: 'longform' | 'shortform'
    view_count: number | null
  }>
}

export default function CreatorDashboardPage() {
  const [stats, setStats] = useState<Stats>({ todayRegisteredCount: 0, latest: [] })

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
              <p className="panel-subtitle">최근 입력한 영상의 핵심 정보와 조회수 흐름을 빠르게 확인합니다.</p>
            </div>
          </div>
          <div className="list" style={{ marginTop: 16 }}>
            {stats.latest.length === 0 ? (
              <div className="empty-state">아직 등록된 영상이 없습니다.</div>
            ) : (
              stats.latest.map((item) => (
                <div className="list-item" key={item.id}>
                  <div>{item.title || '제목 없음'}</div>
                  <div className="small muted">
                    {item.stock_name} · {item.content_type === 'longform' ? '롱폼' : '숏폼'} · 조회수 {item.view_count ?? 0}
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
