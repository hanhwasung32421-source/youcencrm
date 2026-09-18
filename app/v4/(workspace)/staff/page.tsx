'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/v4/app-shell'
import { CHART_COLORS, HBarList, ShareBar, Sparkline } from '@/components/v4/charts'
import { EmptyState, KpiCard, PeriodToggle } from '@/components/v4/ui'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson } from '@/lib/session/authed-fetch'
import type { Kpis, PeriodDays, StaffStat } from '@/lib/v4/analytics'
import { fmtNumber, fmtPercent } from '@/lib/v4/format'

type StaffResponse = {
  period: PeriodDays
  range: { start: string; end: string }
  rows: StaffStat[]
  team: Kpis
  error?: string
}

type Metric = 'totalViews' | 'videoCount' | 'avgViews'

const GRID = '44px minmax(120px, 1.2fr) 90px 120px 120px 160px 90px 140px'

export default function StaffComparisonPage() {
  const { toast, showError } = useToast()
  const [period, setPeriod] = useState<PeriodDays>(30)
  const [data, setData] = useState<StaffResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [metric, setMetric] = useState<Metric>('totalViews')

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { ok, data: res } = await authedFetchJson<StaffResponse>(`/api/v4/staff?period=${period}`)
      setLoading(false)
      if (!ok || res?.error) {
        showError(res?.error || '담당자 성과 비교 조회에 실패했습니다.')
        return
      }
      setData(res)
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const bars = useMemo(() => {
    if (!data) return []
    return [...data.rows]
      .sort((a, b) => b[metric] - a[metric])
      .map((row) => ({ label: row.name, value: row[metric], hint: metric === 'videoCount' ? '' : `· ${row.videoCount}편` }))
  }, [data, metric])

  const activeCount = data ? data.rows.filter((r) => r.videoCount > 0).length : 0
  const metricLabel: Record<Metric, string> = { totalViews: '총 조회수', videoCount: '영상 수', avgViews: '평균 조회수' }

  return (
    <>
      <PageHeader
        title="담당자 성과 비교"
        subtitle={data ? `${data.range.start} ~ ${data.range.end} · 담당자 ${fmtNumber(data.rows.length)}명 중 ${fmtNumber(activeCount)}명 업로드` : '담당자별 업로드·조회수·형식 비중을 비교합니다.'}
        actions={<PeriodToggle value={period} onChange={setPeriod} disabled={loading} />}
      />
      <Toast toast={toast} />

      <div className="grid grid-4">
        <KpiCard title="팀 총 조회수" value={fmtNumber(data?.team.totalViews)} tone="indigo" />
        <KpiCard title="팀 영상 수" value={fmtNumber(data?.team.videoCount)} meta={`1인 평균 ${data && data.rows.length ? (data.team.videoCount / data.rows.length).toFixed(1) : '0'}편`} tone="emerald" />
        <KpiCard title="팀 평균 조회수" value={fmtNumber(data?.team.avgViews)} meta="영상당" tone="amber" />
        <KpiCard title="팀 좋아요율" value={fmtPercent(data?.team.likeRate)} tone="rose" />
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">담당자 비교 막대</div>
            <p className="panel-subtitle">기준 지표를 바꿔 순위를 비교합니다.</p>
          </div>
          <div className="v4-segment" role="group" aria-label="비교 지표">
            {(Object.keys(metricLabel) as Metric[]).map((key) => (
              <button key={key} type="button" className={`v4-segment-item ${metric === key ? 'active' : ''}`} onClick={() => setMetric(key)}>
                {metricLabel[key]}
              </button>
            ))}
          </div>
        </div>
        {data && data.rows.length === 0 ? <EmptyState>비교할 담당자가 없습니다.</EmptyState> : <HBarList items={bars} color={metric === 'videoCount' ? CHART_COLORS.EMERALD : CHART_COLORS.INDIGO} />}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">담당자별 상세</div>
            <p className="panel-subtitle">순위는 총 조회수 기준. 스파크라인은 최근 7일 일별 업로드 수입니다.</p>
          </div>
        </div>
        <div className="data-table">
          <div className="data-table-header" style={{ gridTemplateColumns: GRID }}>
            <div>순위</div>
            <div>담당자</div>
            <div className="data-right">영상 수</div>
            <div className="data-right">총 조회수</div>
            <div className="data-right">평균 조회수</div>
            <div>롱폼 / 숏폼</div>
            <div className="data-right">좋아요율</div>
            <div>최근 7일</div>
          </div>
          {!data || data.rows.length === 0 ? (
            <div style={{ padding: 16 }}>
              <EmptyState>표시할 담당자가 없습니다.</EmptyState>
            </div>
          ) : (
            data.rows.map((row) => (
              <div className="data-table-row" style={{ gridTemplateColumns: GRID }} key={row.userId}>
                <div>
                  <span className={`v4-rank ${row.rank <= 3 && row.totalViews > 0 ? 'top' : ''}`}>{row.rank}</span>
                </div>
                <div className="v4-cell-title">{row.name}</div>
                <div className="data-right v4-num">{fmtNumber(row.videoCount)}</div>
                <div className="data-right v4-num">{fmtNumber(row.totalViews)}</div>
                <div className="data-right v4-num">{fmtNumber(row.avgViews)}</div>
                <div>
                  {row.videoCount > 0 ? (
                    <ShareBar a={row.longformCount} b={row.shortformCount} labelA="롱" labelB="숏" />
                  ) : (
                    <span className="muted small">-</span>
                  )}
                </div>
                <div className="data-right v4-num">{fmtPercent(row.likeRate)}</div>
                <div>
                  <Sparkline values={row.sparkline} color={row.sparkline.some((v) => v > 0) ? CHART_COLORS.INDIGO : CHART_COLORS.SLATE} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
