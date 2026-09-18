'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/v3/app-shell'
import { Toast, useToast } from '@/components/toast'
import { Callout, DocRow, DocTable, KpiCard, MonthPicker, SampleBanner, Section, Tag, type DocColumn } from '@/components/v3/ui'
import { authedFetchJson } from '@/lib/session/authed-fetch'
import { formatMonthLabel, getCurrentMonth, type IncentiveBreakdown, type IncentiveRule, type IncentiveSettlement } from '@/lib/v3/finance'
import { formatDateTime, formatKrw, formatNumber } from '@/lib/v3/format'

type Video = {
  id: string
  title: string | null
  stock_name: string | null
  content_type: 'longform' | 'shortform'
  view_count: number
  created_at: string
  youtube_url: string | null
}

type Response = {
  month: string
  sample: boolean
  me: { id: string; name: string }
  rule: Omit<IncentiveRule, 'user_id'>
  ruleIsDefault: boolean
  breakdown: IncentiveBreakdown
  confirmed: IncentiveSettlement | null
  videos: Video[]
  history: IncentiveSettlement[]
  error?: string
}

const VIDEO_COLUMNS: DocColumn[] = [
  { key: 'date', label: '등록일', width: '110px' },
  { key: 'title', label: '영상', width: 'minmax(0, 1.8fr)' },
  { key: 'type', label: '유형', width: '70px' },
  { key: 'views', label: '조회수', width: '110px', align: 'right' },
  { key: 'pay', label: '영상 단가분', width: '110px', align: 'right' },
  { key: 'viewpay', label: '조회수분', width: '110px', align: 'right' }
]

const HISTORY_COLUMNS: DocColumn[] = [
  { key: 'month', label: '월', width: '110px' },
  { key: 'videos', label: '영상 수', width: '100px', align: 'right' },
  { key: 'views', label: '조회수', width: '130px', align: 'right' },
  { key: 'amount', label: '확정 정산액', width: '140px', align: 'right' },
  { key: 'at', label: '확정 시각', width: 'minmax(0, 1fr)' }
]

export default function MySettlementPage() {
  const { toast, showError } = useToast()
  const [month, setMonth] = useState(getCurrentMonth())
  const [data, setData] = useState<Response | null>(null)

  const load = useCallback(
    async (target: string) => {
      const { ok, data } = await authedFetchJson<Response>(`/api/v3/my-settlement?month=${target}`)
      if (!ok || data?.error) {
        showError(data?.error || '내 정산 조회에 실패했습니다.')
        return
      }
      setData(data)
    },
    [showError]
  )

  useEffect(() => {
    void load(month)
  }, [month, load])

  const rule = data?.rule
  const weightOf = (type: Video['content_type']) => (type === 'shortform' ? Number(rule?.shortform_weight || 0) : Number(rule?.longform_weight || 0))

  return (
    <>
      <PageHeader
        icon="🙋"
        title="내 정산"
        subtitle="이번 달 내가 등록한 영상 실적과 예상 인센티브, 지난 확정 내역을 확인합니다."
        actions={<MonthPicker value={month} onChange={setMonth} />}
      />
      <Toast toast={toast} />
      <SampleBanner show={!!data?.sample} />

      {data ? (
        <>
          {data.confirmed && data.confirmed.confirmed_at ? (
            <Callout icon="✅" tone="success">
              <strong>
                {formatMonthLabel(month)} 정산 확정 {formatKrw(data.confirmed.computed_amount)}.
              </strong>{' '}
              {formatDateTime(data.confirmed.confirmed_at)}에 확정된 금액입니다. (영상 {formatNumber(data.confirmed.video_count)}개 · 조회수{' '}
              {formatNumber(data.confirmed.total_views)}회 기준)
            </Callout>
          ) : (
            <Callout icon="🧮" tone="info">
              <strong>
                {data.me.name}님의 {formatMonthLabel(month)} 예상 인센티브는 {formatKrw(data.breakdown.amount)}입니다.
              </strong>{' '}
              영상 {formatNumber(data.breakdown.videoCount)}개(롱폼 {data.breakdown.longformCount} · 숏폼 {data.breakdown.shortformCount}), 누적 조회수{' '}
              {formatNumber(data.breakdown.totalViews)}회 기준이며 관리자가 확정하기 전까지는 조회수 변화에 따라 달라질 수 있습니다.
            </Callout>
          )}

          <div className="v3-kpi-grid">
            <KpiCard label="예상 정산액" current={data.breakdown.amount} />
            <KpiCard label="이 달 영상" current={data.breakdown.videoCount} format={(v) => `${formatNumber(v)}개`} />
            <KpiCard label="이 달 조회수" current={data.breakdown.totalViews} format={(v) => `${formatNumber(v)}회`} />
            <div className="v3-kpi">
              <div className="v3-kpi-label">적용 규칙 {data.ruleIsDefault ? <Tag tone="gray">기본</Tag> : null}</div>
              <div className="small" style={{ marginTop: 6, lineHeight: 1.7 }}>
                기본급 {formatKrw(data.rule.base_pay)}
                <br />
                영상당 {formatKrw(data.rule.per_video)} · 1,000회당 {formatKrw(data.rule.per_1k_views)}
                <br />
                롱폼 ×{data.rule.longform_weight} · 숏폼 ×{data.rule.shortform_weight}
              </div>
            </div>
          </div>

          <Section title="정산액 구성">
            <div className="v3-chart-card">
              <table className="v3-print-table">
                <tbody>
                  <tr>
                    <td>기본급</td>
                    <td className="num">{formatKrw(data.breakdown.basePay)}</td>
                  </tr>
                  <tr>
                    <td>
                      영상 단가분 <span className="muted small">(가중 영상 수 {data.breakdown.weightedVideoUnits.toLocaleString('ko-KR')} × {formatKrw(data.rule.per_video)})</span>
                    </td>
                    <td className="num">{formatKrw(data.breakdown.videoPay)}</td>
                  </tr>
                  <tr>
                    <td>
                      조회수분 <span className="muted small">(가중 조회수 {formatNumber(Math.round(data.breakdown.weightedViews))} ÷ 1,000 × {formatKrw(data.rule.per_1k_views)})</span>
                    </td>
                    <td className="num">{formatKrw(data.breakdown.viewPay)}</td>
                  </tr>
                  <tr className="total">
                    <td>예상 정산액</td>
                    <td className="num">{formatKrw(data.breakdown.amount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="이 달 내 영상" count={data.videos.length} description="youtubeCRM_videos에 등록된 영상 기준입니다.">
            <DocTable columns={VIDEO_COLUMNS} isEmpty={data.videos.length === 0} empty="이 달에 등록한 영상이 없습니다.">
              {data.videos.map((video) => {
                const weight = weightOf(video.content_type)
                const videoPay = Math.floor(weight * Number(rule?.per_video || 0))
                const viewPay = Math.floor(((video.view_count * weight) / 1000) * Number(rule?.per_1k_views || 0))
                return (
                  <DocRow columns={VIDEO_COLUMNS} key={video.id}>
                    <div className="small muted">{video.created_at.slice(0, 10)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="v3-cell-main">
                        {video.youtube_url ? (
                          <a className="v3-link" href={video.youtube_url} target="_blank" rel="noreferrer">
                            {video.title || video.stock_name || '(제목 없음)'}
                          </a>
                        ) : (
                          video.title || video.stock_name || '(제목 없음)'
                        )}
                      </div>
                      {video.stock_name ? <div className="v3-cell-sub">{video.stock_name}</div> : null}
                    </div>
                    <div>
                      <Tag tone={video.content_type === 'shortform' ? 'violet' : 'blue'}>{video.content_type === 'shortform' ? '숏폼' : '롱폼'}</Tag>
                    </div>
                    <div className="data-right">{formatNumber(video.view_count)}</div>
                    <div className="data-right muted">{formatKrw(videoPay)}</div>
                    <div className="data-right muted">{formatKrw(viewPay)}</div>
                  </DocRow>
                )
              })}
            </DocTable>
          </Section>

          <Section title="지난 확정 정산" count={data.history.length}>
            <DocTable columns={HISTORY_COLUMNS} isEmpty={data.history.length === 0} empty="아직 확정된 정산이 없습니다.">
              {data.history.map((row) => (
                <DocRow columns={HISTORY_COLUMNS} key={row.id}>
                  <div className="v3-cell-main">{formatMonthLabel(row.month)}</div>
                  <div className="data-right">{formatNumber(row.video_count)}</div>
                  <div className="data-right">{formatNumber(row.total_views)}</div>
                  <div className="data-right" style={{ fontWeight: 700 }}>
                    {formatKrw(row.computed_amount)}
                  </div>
                  <div className="small muted">{formatDateTime(row.confirmed_at)}</div>
                </DocRow>
              ))}
            </DocTable>
          </Section>
        </>
      ) : (
        <div className="empty-state">정산 정보를 불러오는 중입니다.</div>
      )}
    </>
  )
}
