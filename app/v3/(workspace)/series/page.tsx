'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/v3/app-shell'
import { Toast, useToast } from '@/components/toast'
import { EmptyState, SampleBanner, Section } from '@/components/v3/ui'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { formatNumber, formatPct, formatSignedPct } from '@/lib/v3/format'
import { pctChange } from '@/lib/v3/engagement'
import { SAMPLE_STOCK_NAMES } from '@/lib/v3/sample-data'

type FormatStat = { label: string; contentType: string; count: number; avgEngagementPct: number; avgVelocity: number; totalViews: number }

type SeriesRow = {
  id: string
  name: string
  stockName: string | null
  videoCount: number
  avgEngagementPct: number
  avgVelocity: number
  baselineEngagementPct: number
  baselineVelocity: number
}

type EligibleVideo = { id: string; title: string; stockName: string | null; contentType: string }

type FormatSeriesResponse = {
  sample: boolean
  formatStats: { longform: FormatStat; shortform: FormatStat }
  series: SeriesRow[]
  eligibleVideos: EligibleVideo[]
}

function Delta({ current, baseline, digits = 1, suffix = '%p' }: { current: number; baseline: number; digits?: number; suffix?: string }) {
  const change = pctChange(current, baseline)
  const positive = change !== null && change > 0
  const negative = change !== null && change < 0
  return (
    <span className={positive ? 'v3-delta-up' : negative ? 'v3-delta-down' : 'muted'}>
      {change === null ? '비교 불가' : `${formatSignedPct(change, digits)} (${suffix === '%p' ? `${(current - baseline).toFixed(digits)}%p` : suffix})`}
    </span>
  )
}

export default function SeriesPage() {
  const { toast, showSuccess, showError } = useToast()
  const [data, setData] = useState<FormatSeriesResponse | null>(null)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [stockName, setStockName] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [addPickers, setAddPickers] = useState<Record<string, string>>({})
  const [addingSeriesId, setAddingSeriesId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { ok, data } = await authedFetchJson<FormatSeriesResponse>('/api/v3/format-series')
    if (!ok) {
      showError((data as any)?.error || '형식 · 시리즈 효과 분석에 실패했습니다.')
      return
    }
    setData(data)
  }, [showError])

  useEffect(() => {
    void load()
  }, [load])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const createSeries = async () => {
    if (!name.trim()) {
      showError('시리즈 이름을 입력해 주세요.')
      return
    }
    setCreating(true)
    try {
      const { ok, data } = await authedPostJson<{ error?: string }>('/api/v3/series', {
        name: name.trim(),
        stockName: stockName.trim() || undefined,
        videoIds: selectedIds
      })
      if (!ok) {
        showError(data?.error || '시리즈 생성에 실패했습니다.')
        return
      }
      showSuccess('시리즈를 만들었습니다.')
      setName('')
      setStockName('')
      setSelectedIds([])
      setShowForm(false)
      await load()
    } finally {
      setCreating(false)
    }
  }

  const addToSeries = async (seriesId: string) => {
    const videoId = addPickers[seriesId]
    if (!videoId) {
      showError('추가할 영상을 선택해 주세요.')
      return
    }
    setAddingSeriesId(seriesId)
    try {
      const { ok, data } = await authedPostJson<{ error?: string }>(`/api/v3/series/${seriesId}/members`, { videoId })
      if (!ok) {
        showError(data?.error || '영상 추가에 실패했습니다.')
        return
      }
      showSuccess('시리즈에 영상을 추가했습니다.')
      setAddPickers((prev) => ({ ...prev, [seriesId]: '' }))
      await load()
    } finally {
      setAddingSeriesId(null)
    }
  }

  const stats = data?.formatStats

  return (
    <>
      <PageHeader icon="🧩" title="형식 · 시리즈 효과 분석" subtitle="롱폼과 숏폼 중 무엇이 더 '깊이' 참여를 이끄는지, 시리즈로 묶었을 때 성과가 달라지는지를 봅니다." />
      <Toast toast={toast} />
      <SampleBanner show={!!data?.sample} />

      {stats ? (
        <Section title="롱폼 vs 숏폼 참여 효율" description="건수 비교가 아니라, 평균 참여율과 평균 조회 속도로 형식의 질을 비교합니다.">
          <div className="v3-chart-card">
            <table className="v3-print-table">
              <thead>
                <tr>
                  <th>형식</th>
                  <th className="num">영상 수</th>
                  <th className="num">평균 참여율</th>
                  <th className="num">평균 조회 속도</th>
                  <th className="num">누적 조회수</th>
                </tr>
              </thead>
              <tbody>
                {[stats.longform, stats.shortform].map((row) => (
                  <tr key={row.contentType}>
                    <td>{row.label}</td>
                    <td className="num">{formatNumber(row.count)}개</td>
                    <td className="num">{formatPct(row.avgEngagementPct, 2)}</td>
                    <td className="num">{formatNumber(Math.round(row.avgVelocity))}회/일</td>
                    <td className="num">{formatNumber(row.totalViews)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : (
        <div className="empty-state">형식 · 시리즈 데이터를 불러오는 중입니다.</div>
      )}

      <Section
        title="시리즈 트래커"
        count={data?.series.length ?? 0}
        description="같은 종목의 시리즈 밖 영상(기준선) 대비 참여율 · 조회 속도 차이를 보여줍니다."
        actions={
          <button className="button secondary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? '취소' : '새 시리즈 만들기'}
          </button>
        }
      >
        {showForm ? (
          <div className="v3-inline-form">
            <div className="v3-form-grid">
              <div className="field">
                <label className="label">시리즈 이름</label>
                <input className="input" value={name} disabled={creating} onChange={(e) => setName(e.target.value)} placeholder="예: 삼성전자 실적 브리핑 시리즈" />
              </div>
              <div className="field">
                <label className="label">종목(선택)</label>
                <input className="input" list="v3-series-stock-suggestions" value={stockName} disabled={creating} onChange={(e) => setStockName(e.target.value)} />
                <datalist id="v3-series-stock-suggestions">
                  {SAMPLE_STOCK_NAMES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="field">
              <label className="label">묶을 영상 선택 (선택 {selectedIds.length}개)</label>
              <div className="v3-picker-list" style={{ maxHeight: 220 }}>
                {(data?.eligibleVideos || []).length === 0 ? (
                  <EmptyState>추가할 수 있는 영상이 없습니다.</EmptyState>
                ) : (
                  data!.eligibleVideos.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={`v3-picker-item ${selectedIds.includes(v.id) ? 'selected' : ''}`}
                      disabled={creating}
                      onClick={() => toggleSelect(v.id)}
                    >
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.title}
                        {v.stockName ? <span className="v3-cell-sub"> · {v.stockName}</span> : null}
                      </span>
                      <span className="small muted">{selectedIds.includes(v.id) ? '선택됨' : ''}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
            <button className="button" disabled={creating} style={{ justifySelf: 'start' }} onClick={createSeries}>
              {creating ? '만드는 중...' : '시리즈 만들기'}
            </button>
          </div>
        ) : null}

        {!data || data.series.length === 0 ? (
          <EmptyState>아직 만든 시리즈가 없습니다.</EmptyState>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.series.map((s) => (
              <div className="v3-chart-card" key={s.id}>
                <div className="row-between">
                  <div>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    <div className="v3-cell-sub">{s.stockName || '종목 무관'} · 영상 {s.videoCount}개</div>
                  </div>
                </div>
                <div className="v3-form-grid" style={{ marginTop: 10 }}>
                  <div className="small">
                    참여율 {formatPct(s.avgEngagementPct, 2)} <span className="muted">(기준선 {formatPct(s.baselineEngagementPct, 2)})</span>
                    <br />
                    <Delta current={s.avgEngagementPct} baseline={s.baselineEngagementPct} digits={1} />
                  </div>
                  <div className="small">
                    조회 속도 {formatNumber(Math.round(s.avgVelocity))}회/일 <span className="muted">(기준선 {formatNumber(Math.round(s.baselineVelocity))}회/일)</span>
                    <br />
                    <Delta current={s.avgVelocity} baseline={s.baselineVelocity} digits={1} />
                  </div>
                </div>
                {!data.sample && data.eligibleVideos.length > 0 ? (
                  <div className="row" style={{ marginTop: 10 }}>
                    <select
                      className="select"
                      value={addPickers[s.id] || ''}
                      onChange={(e) => setAddPickers((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    >
                      <option value="">영상 선택…</option>
                      {data.eligibleVideos.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.title}
                        </option>
                      ))}
                    </select>
                    <button className="button secondary xs" disabled={addingSeriesId === s.id} onClick={() => void addToSeries(s.id)}>
                      {addingSeriesId === s.id ? '추가 중...' : '이 시리즈에 추가'}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  )
}
