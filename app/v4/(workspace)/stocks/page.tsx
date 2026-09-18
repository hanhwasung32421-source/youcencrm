'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/v4/app-shell'
import { EmptyState, PeriodToggle, TrendArrow } from '@/components/v4/ui'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson } from '@/lib/session/authed-fetch'
import type { PeriodDays, StockAggregate } from '@/lib/v4/analytics'
import { fmtCompact, fmtDateKst, fmtNumber } from '@/lib/v4/format'

type StocksResponse = {
  scope: 'admin' | 'staff'
  period: PeriodDays
  range: { start: string; end: string }
  previousRange: { start: string; end: string }
  items: StockAggregate[]
  top5Recent: Array<{ stockName: string; videoCount: number; totalViews: number; avgViews: number }>
  totals: { stockCount: number; videoCount: number }
  error?: string
}

type SortKey = 'videoCount' | 'totalViews' | 'avgViews' | 'ownerCount' | 'changeRatio'

const GRID = '36px minmax(160px, 1.6fr) 80px 120px 120px 110px 90px 110px'
const MAX_TILES = 36

export default function StockTrendsPage() {
  const { toast, showError } = useToast()
  const [period, setPeriod] = useState<PeriodDays>(30)
  const [data, setData] = useState<StocksResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('totalViews')
  const [sortDesc, setSortDesc] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { ok, data: res } = await authedFetchJson<StocksResponse>(`/api/v4/stocks?period=${period}`)
      setLoading(false)
      if (!ok || res?.error) {
        showError(res?.error || '종목 트렌드 조회에 실패했습니다.')
        return
      }
      setData(res)
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const rows = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    const filtered = q ? data.items.filter((s) => s.stockName.toLowerCase().includes(q)) : data.items
    return [...filtered].sort((a, b) => (sortDesc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]))
  }, [data, query, sortKey, sortDesc])

  const tiles = useMemo(() => (data ? data.items.slice(0, MAX_TILES) : []), [data])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc((v) => !v)
    else {
      setSortKey(key)
      setSortDesc(true)
    }
  }

  const header = (key: SortKey, label: string) => (
    <div className="data-right">
      <button type="button" className={`v4-th ${sortKey === key ? 'active' : ''}`} onClick={() => toggleSort(key)}>
        {label} {sortKey === key ? (sortDesc ? '▼' : '▲') : ''}
      </button>
    </div>
  )

  return (
    <>
      <PageHeader
        title="종목 트렌드"
        subtitle={
          data
            ? `${data.range.start} ~ ${data.range.end} · 종목 ${fmtNumber(data.totals.stockCount)}개 / 영상 ${fmtNumber(data.totals.videoCount)}개 · 추세는 직전 기간(${data.previousRange.start} ~ ${data.previousRange.end}) 대비`
            : '어떤 종목이 조회수를 끌어오는지 확인합니다.'
        }
        actions={<PeriodToggle value={period} onChange={setPeriod} disabled={loading} />}
      />
      <Toast toast={toast} />

      <div className="grid grid-3">
        <div className="panel" style={{ gridColumn: 'span 2' }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">종목 타일 맵</div>
              <p className="panel-subtitle">타일 크기 = 기간 내 총 조회수 분위(상위 10% 대형). 상위 {MAX_TILES}개 종목까지 표시합니다.</p>
            </div>
          </div>
          {tiles.length === 0 ? (
            <EmptyState>이 기간에 등록된 영상이 없습니다.</EmptyState>
          ) : (
            <div className="v4-tiles">
              {tiles.map((s) => (
                <div className={`v4-tile size-${s.sizeClass}`} key={s.stockName} title={`${s.stockName} · 영상 ${s.videoCount}개 · 총 ${fmtNumber(s.totalViews)}회`}>
                  <div className="v4-tile-name">{s.stockName}</div>
                  <div className="v4-tile-meta">
                    <span>{fmtCompact(s.totalViews)}회</span>
                    <span>{s.videoCount}편</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="v4-callout">
          <div className="v4-callout-title">최근 30일 가장 반응 좋은 종목 Top 5</div>
          <p className="small muted" style={{ marginTop: -4, marginBottom: 10 }}>영상당 평균 조회수 기준 (기간 토글과 무관)</p>
          {!data || data.top5Recent.length === 0 ? (
            <EmptyState>최근 30일 데이터가 없습니다.</EmptyState>
          ) : (
            <div className="v4-callout-list">
              {data.top5Recent.map((s, index) => (
                <div className="v4-callout-item" key={s.stockName}>
                  <span className={`v4-rank ${index === 0 ? 'top' : ''}`}>{index + 1}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="v4-cell-title">{s.stockName}</div>
                    <div className="small muted">영상 {s.videoCount}편 · 총 {fmtNumber(s.totalViews)}회</div>
                  </div>
                  <div className="v4-num">{fmtNumber(s.avgViews)}회/편</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">종목별 집계</div>
            <p className="panel-subtitle">열 제목을 눌러 정렬합니다.</p>
          </div>
          <input className="input" style={{ maxWidth: 220 }} placeholder="종목 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="data-table">
          <div className="data-table-header" style={{ gridTemplateColumns: GRID }}>
            <div>#</div>
            <div>종목</div>
            {header('videoCount', '영상 수')}
            {header('totalViews', '총 조회수')}
            {header('avgViews', '평균 조회수')}
            <div>최근 언급일</div>
            {header('ownerCount', '담당자')}
            {header('changeRatio', '추세')}
          </div>
          {rows.length === 0 ? (
            <div style={{ padding: 16 }}>
              <EmptyState>표시할 종목이 없습니다.</EmptyState>
            </div>
          ) : (
            rows.map((s, index) => (
              <div className="data-table-row" style={{ gridTemplateColumns: GRID }} key={s.stockName}>
                <div>
                  <span className="v4-rank">{index + 1}</span>
                </div>
                <div className="v4-cell-title" title={s.stockName}>{s.stockName}</div>
                <div className="data-right v4-num">{fmtNumber(s.videoCount)}</div>
                <div className="data-right v4-num">{fmtNumber(s.totalViews)}</div>
                <div className="data-right v4-num">{fmtNumber(s.avgViews)}</div>
                <div>{fmtDateKst(s.lastMentionedAt)}</div>
                <div className="data-right v4-num">{fmtNumber(s.ownerCount)}명</div>
                <div className="data-right">
                  <TrendArrow trend={s.trend} ratio={s.changeRatio} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
