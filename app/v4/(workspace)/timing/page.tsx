'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/v4/app-shell'
import { Heatmap } from '@/components/v4/charts'
import { EmptyState, PeriodToggle } from '@/components/v4/ui'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson } from '@/lib/session/authed-fetch'
import type { HeatCell, PeriodDays } from '@/lib/v4/analytics'
import { WEEKDAY_LABELS, fmtCompact, fmtNumber } from '@/lib/v4/format'

type TimingResponse = {
  scope: 'admin' | 'staff'
  period: PeriodDays
  range: { start: string; end: string }
  sampleCount: number
  cells: HeatCell[]
  recommendations: HeatCell[]
  maxCount: number
  maxAvg: number
  error?: string
}

export default function UploadTimingPage() {
  const { toast, showError } = useToast()
  const [period, setPeriod] = useState<PeriodDays>(30)
  const [data, setData] = useState<TimingResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { ok, data: res } = await authedFetchJson<TimingResponse>(`/api/v4/timing?period=${period}`)
      setLoading(false)
      if (!ok || res?.error) {
        showError(res?.error || '업로드 타이밍 분석 조회에 실패했습니다.')
        return
      }
      setData(res)
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const highlight = useMemo(() => new Set((data?.recommendations || []).map((c) => `${c.weekday}-${c.hour}`)), [data])

  // 요일별/시간대별 합계 (보조 지표)
  const byWeekday = useMemo(() => {
    if (!data) return []
    return Array.from({ length: 7 }, (_, weekday) => {
      const cells = data.cells.filter((c) => c.weekday === weekday)
      const count = cells.reduce((s, c) => s + c.count, 0)
      const views = cells.reduce((s, c) => s + c.totalViews, 0)
      return { weekday, count, avg: count > 0 ? Math.round(views / count) : 0 }
    })
  }, [data])

  const busiestHour = useMemo(() => {
    if (!data) return null
    const totals = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: data.cells.filter((c) => c.hour === hour).reduce((s, c) => s + c.count, 0)
    }))
    return totals.sort((a, b) => b.count - a.count)[0] || null
  }, [data])

  return (
    <>
      <PageHeader
        title="업로드 타이밍 분석"
        subtitle={data ? `${data.range.start} ~ ${data.range.end} · 영상 ${fmtNumber(data.sampleCount)}개 · KST 게시 시각(published_at, 없으면 등록 시각) 기준` : '언제 올린 영상이 잘 나오는지 요일 × 시간대로 봅니다.'}
        actions={<PeriodToggle value={period} onChange={setPeriod} disabled={loading} />}
      />
      <Toast toast={toast} />

      <div className="v4-callout">
        <div className="v4-callout-title">추천 업로드 슬롯 Top 3</div>
        <p className="small muted" style={{ marginTop: -4, marginBottom: 10 }}>같은 요일·시간대에 2개 이상 업로드된 슬롯 중 평균 조회수가 높은 순. 히트맵에 노란 테두리로 표시됩니다.</p>
        {!data || data.recommendations.length === 0 ? (
          <EmptyState>추천할 만큼 데이터가 쌓이지 않았습니다 (슬롯당 최소 2개 영상 필요).</EmptyState>
        ) : (
          <div className="v4-callout-list">
            {data.recommendations.map((cell, index) => (
              <div className="v4-callout-item" key={`${cell.weekday}-${cell.hour}`}>
                <span className={`v4-rank ${index === 0 ? 'top' : ''}`}>{index + 1}</span>
                <div style={{ flex: 1 }}>
                  <div className="v4-cell-title">
                    {WEEKDAY_LABELS[cell.weekday]}요일 {cell.hour}시 ~ {cell.hour + 1}시
                  </div>
                  <div className="small muted">업로드 {cell.count}개 · 총 {fmtNumber(cell.totalViews)}회</div>
                </div>
                <div className="v4-num">평균 {fmtNumber(cell.avgViews)}회</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">업로드 수 히트맵</div>
            <p className="panel-subtitle">셀 = 해당 요일·시간대에 게시된 영상 수. {busiestHour && busiestHour.count > 0 ? `가장 많이 올리는 시간대는 ${busiestHour.hour}시(${busiestHour.count}개).` : ''}</p>
          </div>
        </div>
        {data && data.sampleCount === 0 ? (
          <EmptyState>이 기간에 등록된 영상이 없습니다.</EmptyState>
        ) : data ? (
          <Heatmap cells={data.cells} max={data.maxCount} valueOf={(c) => c.count} color="indigo" weekdayLabels={WEEKDAY_LABELS} highlight={highlight} />
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">평균 조회수 히트맵</div>
            <p className="panel-subtitle">셀 = 해당 슬롯에 게시된 영상들의 평균 조회수. 표본이 1개뿐인 슬롯은 참고만 하세요.</p>
          </div>
        </div>
        {data && data.sampleCount === 0 ? (
          <EmptyState>이 기간에 등록된 영상이 없습니다.</EmptyState>
        ) : data ? (
          <Heatmap cells={data.cells} max={data.maxAvg} valueOf={(c) => c.avgViews} color="emerald" weekdayLabels={WEEKDAY_LABELS} format={fmtCompact} highlight={highlight} />
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">요일별 요약</div>
          </div>
        </div>
        <div className="data-table">
          <div className="data-table-header" style={{ gridTemplateColumns: '80px 1fr 1fr' }}>
            <div>요일</div>
            <div className="data-right">업로드 수</div>
            <div className="data-right">평균 조회수</div>
          </div>
          {byWeekday.map((row) => (
            <div className="data-table-row" style={{ gridTemplateColumns: '80px 1fr 1fr' }} key={row.weekday}>
              <div>{WEEKDAY_LABELS[row.weekday]}</div>
              <div className="data-right v4-num">{fmtNumber(row.count)}</div>
              <div className="data-right v4-num">{fmtNumber(row.avg)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
