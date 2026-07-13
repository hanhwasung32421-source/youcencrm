'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'
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
  }>
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({ todayRegisteredCount: 0, unknownIpCount: 0, latest: [] })

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
                <p className="panel-subtitle">전체 팀 기준으로 최신 등록 영상과 통계 반영 상태를 확인합니다.</p>
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
        </div>
      </AppShell>
    </AuthGuard>
  )
}
