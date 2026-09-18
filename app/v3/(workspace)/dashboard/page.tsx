'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/v3/app-shell'
import { Toast, useToast } from '@/components/toast'
import { Callout, KpiCard, MonthPicker, SampleBanner, Section } from '@/components/v3/ui'
import { DonutChart, RankBars, StackedBarChart } from '@/components/v3/charts'
import { authedFetchJson } from '@/lib/session/authed-fetch'
import { formatMonthLabel, getCurrentMonth, STREAM_COLORS, STREAM_LABELS, STREAM_TYPES, type StreamType } from '@/lib/v3/finance'
import { formatKrw, formatNumber } from '@/lib/v3/format'

type Pair = { current: number; previous: number }

type DashboardResponse = {
  sample: boolean
  month: string
  previousMonth: string
  summary: string
  kpis: {
    revenueTotal: Pair
    adsense: Pair
    membershipSuperchat: Pair
    sponsorship: Pair
    leadingProduct: Pair
    expense: Pair
    incentive: Pair
    netProfit: Pair
  }
  revenueByStream: Record<StreamType, number>
  trend: { month: string; byStream: Record<StreamType, number>; total: number }[]
  mix: { stream: StreamType; label: string; amount: number; share: number }[]
  attribution: { pool: number; totalViews: number; videoCount: number }
  topVideos: { id: string; title: string; stock_name: string | null; content_type: string; owner_name: string; view_count: number; youtube_url: string | null; revenue: number }[]
  topStaff: { userId: string; name: string; videoRevenue: number; sponsorshipRevenue: number; videoCount: number; views: number; total: number }[]
  error?: string
}

export default function RevenueDashboardPage() {
  const { toast, showError } = useToast()
  const [month, setMonth] = useState(getCurrentMonth())
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(
    async (target: string) => {
      setLoading(true)
      const { ok, data } = await authedFetchJson<DashboardResponse>(`/api/v3/dashboard?month=${target}`)
      setLoading(false)
      if (!ok || data?.error) {
        showError(data?.error || '대시보드 조회에 실패했습니다.')
        return
      }
      setData(data)
    },
    [showError]
  )

  useEffect(() => {
    void load(month)
  }, [month, load])

  const series = STREAM_TYPES.map((stream) => ({ key: stream, label: STREAM_LABELS[stream], color: STREAM_COLORS[stream] }))

  return (
    <>
      <PageHeader
        icon="📊"
        title="매출 대시보드"
        subtitle={`${formatMonthLabel(month)} 기준 매출·비용·순이익과 12개월 추이를 한 페이지에 정리합니다.`}
        actions={<MonthPicker value={month} onChange={setMonth} disabled={loading} />}
      />
      <Toast toast={toast} />
      <SampleBanner show={!!data?.sample} />

      {data ? (
        <>
          <Callout icon="🧾" tone="info">
            <strong>이번 달 요약.</strong> {data.summary}
          </Callout>

          <Section title="핵심 지표" description={`전월(${formatMonthLabel(data.previousMonth)}) 대비 변화율을 함께 표시합니다.`}>
            <div className="v3-kpi-grid">
              <KpiCard label="총매출" current={data.kpis.revenueTotal.current} previous={data.kpis.revenueTotal.previous} />
              <KpiCard label="애드센스" current={data.kpis.adsense.current} previous={data.kpis.adsense.previous} />
              <KpiCard label="멤버십 · 슈퍼챗" current={data.kpis.membershipSuperchat.current} previous={data.kpis.membershipSuperchat.previous} />
              <KpiCard label="협찬 · 광고" current={data.kpis.sponsorship.current} previous={data.kpis.sponsorship.previous} />
              <KpiCard label="리딩 상품" current={data.kpis.leadingProduct.current} previous={data.kpis.leadingProduct.previous} />
              <KpiCard label="비용" current={data.kpis.expense.current} previous={data.kpis.expense.previous} invert />
              <KpiCard label="직원 인센티브" current={data.kpis.incentive.current} previous={data.kpis.incentive.previous} invert />
              <KpiCard label="순이익" current={data.kpis.netProfit.current} previous={data.kpis.netProfit.previous} />
            </div>
          </Section>

          <Section title="12개월 매출 추이" description="수익원별로 쌓아 올린 월 매출입니다. 마지막 막대가 선택한 달입니다.">
            <StackedBarChart
              series={series}
              points={data.trend.map((point) => ({ month: point.month, values: point.byStream, total: point.total }))}
            />
          </Section>

          <div className="grid grid-2">
            <Section title="매출 비중" description="선택한 달의 수익원 구성입니다.">
              <DonutChart
                slices={data.mix.map((row) => ({ key: row.stream, label: row.label, value: row.amount, color: STREAM_COLORS[row.stream] }))}
              />
            </Section>
            <Section title="직원별 귀속 매출" description="영상 귀속 매출 + 담당 협찬 계약금액 합계 순위입니다.">
              <div className="v3-chart-card">
                <RankBars
                  color="#2f9e6e"
                  items={data.topStaff.map((row) => ({
                    label: row.name,
                    value: row.total,
                    sub: `영상 ${formatNumber(row.videoCount)}개 · 협찬 ${formatKrw(row.sponsorshipRevenue)}`
                  }))}
                />
              </div>
            </Section>
          </div>

          <Section
            title="수익 상위 영상 TOP 5"
            description={`이 달 등록 영상 ${formatNumber(data.attribution.videoCount)}개, 누적 조회수 ${formatNumber(data.attribution.totalViews)}회에 배분한 결과입니다.`}
          >
            <div className="v3-chart-card">
              {data.topVideos.length === 0 ? (
                <div className="empty-state">이 달에 등록된 영상이 없습니다.</div>
              ) : (
                <div className="v3-video-list">
                  {data.topVideos.map((video, index) => (
                    <div className="v3-video-item" key={video.id}>
                      <span className="v3-rank">{index + 1}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="v3-cell-main">
                          {video.youtube_url ? (
                            <a className="v3-link" href={video.youtube_url} target="_blank" rel="noreferrer">
                              {video.title}
                            </a>
                          ) : (
                            video.title
                          )}
                        </div>
                        <div className="v3-cell-sub">
                          {video.stock_name ? `${video.stock_name} · ` : ''}
                          {video.content_type === 'shortform' ? '숏폼' : '롱폼'} · {video.owner_name}
                        </div>
                      </div>
                      <span className="muted small">{formatNumber(video.view_count)}회</span>
                      <strong className="data-right">{formatKrw(video.revenue)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Callout icon="📐">
              <strong>귀속 공식.</strong> 조회수 비례 스트림(애드센스 · 멤버십 · 슈퍼챗 · 리딩 상품 · 기타)의 월 합계 P = {formatKrw(data.attribution.pool)} 를 이 달 등록 영상의
              조회수 비중대로 나눕니다.
              <div className="v3-formula" style={{ marginTop: 8 }}>
                영상 귀속 매출 = P × ( 영상 조회수 ÷ Σ 이 달 등록 영상 조회수 ){'\n'}
                직원 귀속 매출 = Σ 본인 영상 귀속 매출 + Σ 본인 담당 협찬 인보이스 계약금액 (초안 제외, 발행월 기준)
              </div>
              협찬·광고는 계약 단위라 영상에는 배분하지 않고 담당 직원에게 직접 귀속합니다. 총매출 KPI는 수익원 관리에 기록한 항목만 집계합니다.
            </Callout>
          </Section>
        </>
      ) : (
        <div className="empty-state">대시보드를 불러오는 중입니다.</div>
      )}
    </>
  )
}
