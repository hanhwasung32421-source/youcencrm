'use client'

import { useEffect, useMemo, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'
import { PageLoading } from '@/components/page-loading'
import { Toast, useToast } from '@/components/toast'
import { BarChartCard } from '@/components/bar-chart-card'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import { addDaysToYmd, getAttendancePeriodRange, getKstYmd } from '@/lib/attendance/time'

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
  const [loading, setLoading] = useState(true)
  const { toast, showError } = useToast()

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
    try {
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
        showError((data as any)?.error || '대시보드 조회 실패')
        return
      }
      if ((data as any).mode !== 'table') return
      setTable(data as TableResponse)
    } finally {
      setLoading(false)
    }
  }

  const search = async (override?: { start: string; end: string }) => {
    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const start = override?.start || searchStart
    const end = override?.end || searchEnd
    if (override?.start) setSearchStart(override.start)
    if (override?.end) setSearchEnd(override.end)

    const qs = new URLSearchParams({ searchStart: start, searchEnd: end }).toString()
    const res = await fetch(`/api/dashboard/admin?${qs}`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    const data = (await res.json().catch(() => ({}))) as SearchResponse & { error?: string }
    if (!res.ok || (data as any)?.error) {
      showError((data as any)?.error || '검색 실패')
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
      {typeof bucket.afterCheckInCount === 'number' ? (
        <div className="cell-metric-row">
          <span className="cell-metric-label">출근후/퇴근후</span>
          <span className="data-right">
            {bucket.afterCheckInCount.toLocaleString('ko-KR')}회 / {(bucket.afterCheckOutCount || 0).toLocaleString('ko-KR')}회
          </span>
        </div>
      ) : null}
      <div className="cell-metric-row">
        <span className="cell-metric-label">누적시간</span>
        <span className="data-right">{formatDuration(bucket.durationSeconds)}</span>
      </div>
      <div className="cell-metric-row">
        <span className="cell-metric-label">조회수</span>
        <span className="data-right">{bucket.views.toLocaleString('ko-KR')}회</span>
      </div>
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

  const applyPreset = async (type: 'today' | 'week' | 'month') => {
    const today = getKstYmd(new Date())

    if (type === 'today') {
      await search({ start: today, end: today })
      return
    }

    if (type === 'week') {
      const week = getAttendancePeriodRange('week')
      const start = week.startYmd
      const end = addDaysToYmd(start, 6)
      await search({ start, end })
      return
    }

    const [y, m] = today.split('-').map(Number)
    const start = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    await search({ start, end })
  }

  useEffect(() => {
    void loadTable()
  }, [])

  const todayRankingByCount = useMemo(() => {
    return (table?.rows || [])
      .filter((row) => row.today.count > 0)
      .sort((a, b) => b.today.count - a.today.count)
      .slice(0, 8)
      .map((row) => ({ label: row.name, value: row.today.count }))
  }, [table])

  const monthRankingByViews = useMemo(() => {
    return (table?.rows || [])
      .filter((row) => row.month.views > 0)
      .sort((a, b) => b.month.views - a.month.views)
      .slice(0, 8)
      .map((row) => ({ label: row.name, value: row.month.views }))
  }, [table])

  return (
    <AuthGuard requireAdmin>
      <AppShell title="관리자 대시보드" subtitle="직원별 업무 효율을 확인합니다.">
        {loading ? <PageLoading text="대시보드를 불러오는 중입니다..." /> : null}
        <Toast toast={toast} />

        {searchResult ? null : (
          <div className="grid grid-2">
            <BarChartCard title="오늘 업로드 순위" subtitle="오늘 등록한 영상 수 기준입니다." items={todayRankingByCount} tone="blue" />
            <BarChartCard title="이번달 조회수 순위" subtitle="이번달 등록 영상의 누적 조회수 기준입니다." items={monthRankingByViews} tone="amber" />
          </div>
        )}

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
              <button className="button secondary" onClick={() => search()}>검색</button>
              {searchResult ? (
                <button className="button secondary" onClick={() => setSearchResult(null)}>표 보기</button>
              ) : null}
            </div>
          </div>

          <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
            <button className="button secondary" onClick={() => applyPreset('today')}>오늘</button>
            <button className="button secondary" onClick={() => applyPreset('week')}>일주일</button>
            <button className="button secondary" onClick={() => applyPreset('month')}>이번달</button>
          </div>

          {searchResult ? (
            <div className="data-table dashboard-summary-table search-result-table" style={{ marginTop: 16 }}>
              <div className="data-table-header" style={{ gridTemplateColumns: 'max-content 1fr' }}>
                <div>이름</div>
                <div className="dashboard-header-center">{searchResult.period.startDate} ~ {searchResult.period.endDate}</div>
              </div>
              {searchResult.rows.length === 0 ? (
                <div className="data-table-row" style={{ gridTemplateColumns: 'max-content 1fr' }}>
                  <div className="muted">데이터 없음</div>
                  <div />
                </div>
              ) : (
                searchResult.rows.map((row) => (
                  <div className="data-table-row" key={row.userId} style={{ gridTemplateColumns: 'max-content 1fr' }}>
                    <button className="button secondary" style={{ justifyContent: 'flex-start', width: 'fit-content', whiteSpace: 'nowrap' }} onClick={() => openUploads({
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
