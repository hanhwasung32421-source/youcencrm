'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/v4/app-shell'
import { useV4Me } from '@/components/v4/me-context'
import { EmptyState, FormatPill, PeriodToggle } from '@/components/v4/ui'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson } from '@/lib/session/authed-fetch'
import type { PeriodDays, RankedVideo } from '@/lib/v4/analytics'
import { fmtDateKst, fmtNumber, fmtPercent } from '@/lib/v4/format'

type RankingResponse = {
  scope: 'admin' | 'staff'
  period: PeriodDays
  range: { start: string; end: string }
  items: RankedVideo[]
  staffOptions: Array<{ id: string; name: string }>
  error?: string
}

type SortKey = 'viewCount' | 'likeCount' | 'commentCount' | 'daysSincePublished' | 'velocity' | 'likeRate'
type Mode = 'top' | 'bottom' | 'all'

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: 'viewCount', label: '조회수' },
  { key: 'likeCount', label: '좋아요' },
  { key: 'commentCount', label: '댓글' },
  { key: 'daysSincePublished', label: '경과일' },
  { key: 'velocity', label: '조회 속도' }
]

const GRID = '36px minmax(220px, 2fr) 110px 100px 70px 100px 90px 80px 70px 100px'

export default function ContentRankingPage() {
  const { isAdmin } = useV4Me()
  const { toast, showError } = useToast()
  const [period, setPeriod] = useState<PeriodDays>(30)
  const [data, setData] = useState<RankingResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('viewCount')
  const [sortDesc, setSortDesc] = useState(true)
  const [mode, setMode] = useState<Mode>('top')
  const [staffId, setStaffId] = useState('')
  const [format, setFormat] = useState('')
  const [stockQuery, setStockQuery] = useState('')

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { ok, data: res } = await authedFetchJson<RankingResponse>(`/api/v4/ranking?period=${period}`)
      setLoading(false)
      if (!ok || res?.error) {
        showError(res?.error || '랭킹 조회에 실패했습니다.')
        return
      }
      setData(res)
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const rows = useMemo(() => {
    if (!data) return []
    const q = stockQuery.trim().toLowerCase()
    const filtered = data.items.filter((v) => {
      if (staffId && v.ownerId !== staffId) return false
      if (format && v.contentType !== format) return false
      if (q && !v.stockName.toLowerCase().includes(q) && !v.title.toLowerCase().includes(q)) return false
      return true
    })
    const sorted = [...filtered].sort((a, b) => (sortDesc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]))
    if (mode === 'top') return sorted.slice(0, 10)
    if (mode === 'bottom') return sorted.slice(-10).reverse()
    return sorted
  }, [data, staffId, format, stockQuery, sortKey, sortDesc, mode])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc((v) => !v)
    else {
      setSortKey(key)
      setSortDesc(true)
    }
  }

  const openVideo = (row: RankedVideo) => {
    if (!row.youtubeUrl) return
    window.open(row.youtubeUrl, '_blank', 'noopener,noreferrer')
  }

  const totalInPeriod = data?.items.length || 0

  return (
    <>
      <PageHeader
        title="콘텐츠 성과 랭킹"
        subtitle={data ? `${data.range.start} ~ ${data.range.end} 등록 영상 ${fmtNumber(totalInPeriod)}개 · 행을 누르면 유튜브로 이동합니다.` : '영상별 조회수·반응·조회 속도를 비교합니다.'}
        actions={<PeriodToggle value={period} onChange={setPeriod} disabled={loading} />}
      />
      <Toast toast={toast} />

      <div className="panel soft">
        <div className="toolbar">
          <div className="v4-segment" role="group" aria-label="상위/하위">
            {(
              [
                ['top', 'Top 10'],
                ['bottom', 'Bottom 10'],
                ['all', '전체']
              ] as Array<[Mode, string]>
            ).map(([value, label]) => (
              <button key={value} type="button" className={`v4-segment-item ${mode === value ? 'active' : ''}`} onClick={() => setMode(value)}>
                {label}
              </button>
            ))}
          </div>
          {isAdmin ? (
            <select className="select" style={{ maxWidth: 180 }} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">담당자 전체</option>
              {(data?.staffOptions || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : null}
          <select className="select" style={{ maxWidth: 140 }} value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="">형식 전체</option>
            <option value="longform">롱폼</option>
            <option value="shortform">숏폼</option>
          </select>
          <input
            className="input"
            style={{ maxWidth: 240 }}
            placeholder="종목 / 제목 검색"
            value={stockQuery}
            onChange={(e) => setStockQuery(e.target.value)}
          />
          <span className="small muted">
            {mode === 'all' ? `${fmtNumber(rows.length)}개 표시` : `${sortDesc ? '높은' : '낮은'} 순 기준`}
          </span>
        </div>
      </div>

      <div className="panel">
        <div className="data-table">
          <div className="data-table-header" style={{ gridTemplateColumns: GRID }}>
            <div>#</div>
            <div>제목</div>
            <div>종목</div>
            <div>담당자</div>
            <div>형식</div>
            {COLUMNS.map((col) => (
              <div className="data-right" key={col.key}>
                <button type="button" className={`v4-th ${sortKey === col.key ? 'active' : ''}`} onClick={() => toggleSort(col.key)}>
                  {col.label} {sortKey === col.key ? (sortDesc ? '▼' : '▲') : ''}
                </button>
              </div>
            ))}
            <div className="data-right">
              <button type="button" className={`v4-th ${sortKey === 'likeRate' ? 'active' : ''}`} onClick={() => toggleSort('likeRate')}>
                좋아요율 {sortKey === 'likeRate' ? (sortDesc ? '▼' : '▲') : ''}
              </button>
            </div>
          </div>
          {rows.length === 0 ? (
            <div style={{ padding: 16 }}>
              <EmptyState>{data && totalInPeriod === 0 ? '이 기간에 등록된 영상이 없습니다.' : '조건에 맞는 영상이 없습니다.'}</EmptyState>
            </div>
          ) : (
            rows.map((row, index) => (
              <div
                className="data-table-row clickable"
                style={{ gridTemplateColumns: GRID }}
                key={row.id}
                onClick={() => openVideo(row)}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') openVideo(row)
                }}
                title={row.youtubeUrl ? '유튜브에서 열기' : undefined}
              >
                <div>
                  <span className={`v4-rank ${mode === 'top' && index < 3 ? 'top' : ''}`}>{index + 1}</span>
                </div>
                <div className="v4-cell-title" title={row.title}>
                  {row.title}
                  <div className="small muted">게시 {fmtDateKst(row.publishedAt || row.createdAt)}</div>
                </div>
                <div className="v4-cell-title" title={row.stockName}>{row.stockName}</div>
                <div>{row.ownerName}</div>
                <div>
                  <FormatPill contentType={row.contentType} />
                </div>
                <div className="data-right v4-num">{fmtNumber(row.viewCount)}</div>
                <div className="data-right v4-num">{fmtNumber(row.likeCount)}</div>
                <div className="data-right v4-num">{fmtNumber(row.commentCount)}</div>
                <div className="data-right v4-num">{fmtNumber(row.daysSincePublished)}일</div>
                <div className="data-right v4-num">{fmtNumber(row.velocity)}/일</div>
                <div className="data-right v4-num">{fmtPercent(row.likeRate)}</div>
              </div>
            ))
          )}
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>
          조회 속도 = 조회수 ÷ 게시 후 경과일(최소 1일). 경과일은 published_at(없으면 등록 시각) 기준입니다.
        </p>
      </div>
    </>
  )
}
