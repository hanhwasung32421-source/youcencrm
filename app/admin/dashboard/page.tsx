'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type Bucket = { count: number; durationSeconds: number; views: number }
type Row = {
  userId: string
  name: string
  today: Bucket
  week: Bucket
  month: Bucket
  year: Bucket
}

type TableResponse = {
  mode: 'table'
  buckets: {
    today: { start: string; end: string }
    week: { start: string; end: string }
    month: { start: string; end: string }
    year: { start: string; end: string }
  }
  rows: Row[]
}

type SearchResponse = {
  mode: 'search'
  period: { startDate: string; endDate: string }
  summary: Bucket
}

export default function AdminDashboardPage() {
  const year = useMemo(() => new Date().getFullYear(), [])
  const [table, setTable] = useState<TableResponse | null>(null)
  const [error, setError] = useState('')

  const [searchStart, setSearchStart] = useState(`${year}-01-01`)
  const [searchEnd, setSearchEnd] = useState(`${year}-12-31`)
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null)

  const formatDuration = (seconds: number | null) => {
    if (!seconds || seconds <= 0) return '-'
    const hour = Math.floor(seconds / 3600)
    const minute = Math.floor((seconds % 3600) / 60)
    const second = seconds % 60
    if (hour > 0) return `${hour}시간 ${minute}분 ${second}초`
    if (minute > 0) return `${minute}분 ${second}초`
    return `${second}초`
  }

  const loadTable = async () => {
    setError('')
    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const res = await fetch('/api/dashboard/admin', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    const data = (await res.json().catch(() => ({}))) as TableResponse & { error?: string }
    if (!res.ok || (data as any)?.error) {
      setError((data as any)?.error || '대시보드 조회 실패')
      return
    }
    if ((data as any).mode !== 'table') return
    setTable(data as TableResponse)
  }

  const search = async () => {
    setError('')
    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const qs = new URLSearchParams({ searchStart, searchEnd }).toString()
    const res = await fetch(`/api/dashboard/admin?${qs}`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    const data = (await res.json().catch(() => ({}))) as SearchResponse & { error?: string }
    if (!res.ok || (data as any)?.error) {
      setError((data as any)?.error || '검색 실패')
      return
    }
    if ((data as any).mode !== 'search') return
    setSearchResult(data as SearchResponse)
  }

  const openUploads = (row: Row) => {
    window.open(`/admin/uploads?userId=${row.userId}`, '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    void loadTable()
  }, [])

  return (
    <AuthGuard requireAdmin>
      <AppShell title="관리자 대시보드" subtitle="직원별 업무 효율을 확인합니다.">
        {error ? <div className="message-error small">{error}</div> : null}

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">검색</div>
              <p className="panel-subtitle">검색을 누르면 아래 표는 숨기고, 해당 기간의 업로드 개수/총시간/조회수를 보여줍니다.</p>
            </div>
            <div className="toolbar">
              <input className="input" type="date" style={{ maxWidth: 160 }} value={searchStart} onChange={(e) => setSearchStart(e.target.value)} />
              <input className="input" type="date" style={{ maxWidth: 160 }} value={searchEnd} onChange={(e) => setSearchEnd(e.target.value)} />
              <button className="button secondary" onClick={search}>검색</button>
              {searchResult ? (
                <button className="button secondary" onClick={() => setSearchResult(null)}>표 보기</button>
              ) : null}
            </div>
          </div>

          {searchResult ? (
            <div className="grid grid-4" style={{ marginTop: 16 }}>
              <div className="metric-card">
                <div className="card-title">기간</div>
                <div className="card-meta">{searchResult.period.startDate} ~ {searchResult.period.endDate}</div>
              </div>
              <div className="metric-card">
                <div className="card-title">업로드 개수</div>
                <div className="card-value">{searchResult.summary.count.toLocaleString('ko-KR')}</div>
              </div>
              <div className="metric-card">
                <div className="card-title">총시간</div>
                <div className="card-value">{formatDuration(searchResult.summary.durationSeconds)}</div>
              </div>
              <div className="metric-card">
                <div className="card-title">조회수</div>
                <div className="card-value">{searchResult.summary.views.toLocaleString('ko-KR')}</div>
              </div>
            </div>
          ) : null}
        </div>

        {searchResult ? null : (
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">직원별 업무 효율 표</div>
                <p className="panel-subtitle">
                  오늘 · 일주일(월~일) · 이번달(1일~말일) · 올해 기준으로 (개수, 총시간, 조회수)를 집계합니다. 이름을 누르면 새창으로 업로드 내역이 뜹니다.
                </p>
              </div>
            </div>

            <div className="data-table" style={{ marginTop: 16 }}>
              <div className="data-table-header" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr' }}>
                <div>이름</div>
                <div className="data-right">오늘</div>
                <div className="data-right">일주일</div>
                <div className="data-right">이번달</div>
                <div className="data-right">올해</div>
              </div>

              {!table || table.rows.length === 0 ? (
                <div className="data-table-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr' }}>
                  <div className="muted">데이터 없음</div>
                  <div />
                  <div />
                  <div />
                  <div />
                </div>
              ) : (
                table.rows.map((row) => (
                  <div className="data-table-row" key={row.userId} style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr' }}>
                    <button className="button secondary" style={{ justifyContent: 'flex-start' }} onClick={() => openUploads(row)}>
                      {row.name}
                    </button>
                    <div className="cell-metrics">
                      <div className="data-right">{row.today.count.toLocaleString('ko-KR')}개</div>
                      <div className="muted">{formatDuration(row.today.durationSeconds)}</div>
                      <div className="muted">{row.today.views.toLocaleString('ko-KR')}회</div>
                    </div>
                    <div className="cell-metrics">
                      <div className="data-right">{row.week.count.toLocaleString('ko-KR')}개</div>
                      <div className="muted">{formatDuration(row.week.durationSeconds)}</div>
                      <div className="muted">{row.week.views.toLocaleString('ko-KR')}회</div>
                    </div>
                    <div className="cell-metrics">
                      <div className="data-right">{row.month.count.toLocaleString('ko-KR')}개</div>
                      <div className="muted">{formatDuration(row.month.durationSeconds)}</div>
                      <div className="muted">{row.month.views.toLocaleString('ko-KR')}회</div>
                    </div>
                    <div className="cell-metrics">
                      <div className="data-right">{row.year.count.toLocaleString('ko-KR')}개</div>
                      <div className="muted">{formatDuration(row.year.durationSeconds)}</div>
                      <div className="muted">{row.year.views.toLocaleString('ko-KR')}회</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </AppShell>
    </AuthGuard>
  )
}

