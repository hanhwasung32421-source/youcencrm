'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type Bucket = { count: number; durationSeconds: number; views: number; afterCheckInCount?: number; afterCheckOutCount?: number }
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
  rows: Array<{
    userId: string
    name: string
    period: Bucket
  }>
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

  const renderBucket = (bucket: Bucket) => (
    <div className="cell-metrics">
      <div className="cell-metric-row">
        <span className="cell-metric-label">업로드횟수</span>
        <span className="data-right">{bucket.count.toLocaleString('ko-KR')}개</span>
      </div>
      <div className="cell-metric-row">
        <span className="cell-metric-label">누적시간</span>
        <span className="data-right">{formatDuration(bucket.durationSeconds)}</span>
      </div>
      <div className="cell-metric-row">
        <span className="cell-metric-label">조회수</span>
        <span className="data-right">{bucket.views.toLocaleString('ko-KR')}회</span>
      </div>
      {typeof bucket.afterCheckInCount === 'number' ? (
        <div className="cell-metric-subline">
          (출근후 {bucket.afterCheckInCount.toLocaleString('ko-KR')}회 퇴근후 {(bucket.afterCheckOutCount || 0).toLocaleString('ko-KR')}회)
        </div>
      ) : null}
    </div>
  )

  const formatShortDate = (ymd: string) => {
    const [, month, day] = ymd.split('-').map(Number)
    return `${month}/${day}`
  }

  const todayHeader = table ? `오늘(${formatShortDate(table.buckets.today.start)})` : '오늘'
  const weekHeader = table ? `일주일(${formatShortDate(table.buckets.week.start)}~${formatShortDate(table.buckets.week.end)})` : '일주일'
  const monthHeader = table ? `이번달(${Number(table.buckets.month.start.split('-')[1])}월)` : '이번달'
  const yearHeader = table ? `올해(${Number(table.buckets.year.start.split('-')[0])})` : '올해'

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
              <p className="panel-subtitle">기간을 지정해서 검색하면 직원별 결과 표가 뜹니다.</p>
            </div>
            <div className="toolbar" style={{ justifyContent: 'flex-end', width: '100%' }}>
              <div className="small muted" style={{ marginRight: 4 }}>기간</div>
              <input className="input" type="date" style={{ maxWidth: 160 }} value={searchStart} onChange={(e) => setSearchStart(e.target.value)} />
              <input className="input" type="date" style={{ maxWidth: 160 }} value={searchEnd} onChange={(e) => setSearchEnd(e.target.value)} />
              <button className="button secondary" onClick={search}>검색</button>
              {searchResult ? (
                <button className="button secondary" onClick={() => setSearchResult(null)}>표 보기</button>
              ) : null}
            </div>
          </div>

          {searchResult ? (
            <div className="data-table dashboard-summary-table" style={{ marginTop: 16 }}>
              <div className="data-table-header" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
                <div>이름</div>
                <div className="dashboard-header-center">{searchResult.period.startDate} ~ {searchResult.period.endDate}</div>
              </div>
              {searchResult.rows.length === 0 ? (
                <div className="data-table-row" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
                  <div className="muted">데이터 없음</div>
                  <div />
                </div>
              ) : (
                searchResult.rows.map((row) => (
                  <div className="data-table-row" key={row.userId} style={{ gridTemplateColumns: '1.2fr 1fr' }}>
                    <button className="button secondary" style={{ justifyContent: 'flex-start' }} onClick={() => openUploads({
                      userId: row.userId,
                      name: row.name,
                      today: row.period,
                      week: row.period,
                      month: row.period,
                      year: row.period
                    })}>
                      {row.name}
                    </button>
                    {renderBucket(row.period)}
                  </div>
                ))
              )}
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

            <div className="data-table dashboard-summary-table" style={{ marginTop: 16 }}>
              <div className="data-table-header" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr' }}>
                <div>이름</div>
                <div className="dashboard-header-center">{todayHeader}</div>
                <div className="dashboard-header-center">{weekHeader}</div>
                <div className="dashboard-header-center">{monthHeader}</div>
                <div className="dashboard-header-center">{yearHeader}</div>
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
                    {renderBucket(row.today)}
                    {renderBucket(row.week)}
                    {renderBucket(row.month)}
                    {renderBucket(row.year)}
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
