'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/v3/app-shell'
import { Toast, useToast } from '@/components/toast'
import { Callout, KpiCard, Section } from '@/components/v3/ui'
import { HistogramBars, RankBars, ScatterGrid, type ScatterPoint } from '@/components/v3/charts'
import { useV3Me } from '@/components/v3/auth-guard'
import { authedFetchJson } from '@/lib/session/authed-fetch'
import { formatPct } from '@/lib/v3/format'

type EngagementResponse = {
  summary: string
  videoCount: number
  kpis: {
    avgEngagementPct: { current: number }
    avgCommentRatePct: { current: number }
    thisWeekAvgEngagementPct: { current: number; previous?: number }
  }
  distribution: { key: string; label: string; count: number }[]
  scatter: ScatterPoint[]
  topComment: { id: string; label: string; sub?: string; value: number; youtubeUrl: string | null }[]
  staffOptions: { id: string; name: string }[]
  staffIdFilter: string | null
}

export default function EngagementPage() {
  const me = useV3Me()
  const { toast, showError } = useToast()
  const [data, setData] = useState<EngagementResponse | null>(null)
  const [staffId, setStaffId] = useState('')

  const load = useCallback(
    async (filter: string) => {
      const qs = filter ? `?staffId=${filter}` : ''
      const { ok, data } = await authedFetchJson<EngagementResponse>(`/api/v3/engagement${qs}`)
      if (!ok) {
        showError((data as any)?.error || '참여도 대시보드 조회에 실패했습니다.')
        return
      }
      setData(data)
    },
    [showError]
  )

  useEffect(() => {
    void load(staffId)
  }, [staffId, load])

  return (
    <>
      <PageHeader
        icon="💬"
        title="참여도 대시보드"
        subtitle="조회수가 아니라 '얼마나 깊이 반응했는가'를 봅니다 — 참여율, 댓글 활발도 중심의 지표입니다."
        actions={
          me?.isAdmin && data?.staffOptions?.length ? (
            <select className="select" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">전체 팀</option>
              {data.staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : null
        }
      />
      <Toast toast={toast} />

      {data ? (
        <>
          <Callout icon="🧾" tone="info">
            {data.summary}
          </Callout>

          <div className="v3-kpi-grid">
            <KpiCard label="평균 참여율" current={data.kpis.avgEngagementPct.current} format={(v) => formatPct(v, 2)} />
            <KpiCard label="평균 댓글 비율" current={data.kpis.avgCommentRatePct.current} format={(v) => formatPct(v, 3)} />
            <KpiCard
              label="이번 주 평균 참여율"
              current={data.kpis.thisWeekAvgEngagementPct.current}
              previous={data.kpis.thisWeekAvgEngagementPct.previous}
              format={(v) => formatPct(v, 2)}
            />
            <div className="v3-kpi">
              <div className="v3-kpi-label">분석 대상 영상</div>
              <div className="v3-kpi-value">{data.videoCount.toLocaleString('ko-KR')}개</div>
              <div className="v3-kpi-delta">조회수 0인 영상은 제외</div>
            </div>
          </div>

          <Section title="참여율 분포" description="(좋아요 + 댓글) ÷ 조회수 × 100 을 구간별로 나눈 분포입니다.">
            <HistogramBars buckets={data.distribution} />
          </Section>

          <Section
            title="좋아요 vs 댓글 참여 지형도"
            description="가로: 좋아요 비율, 세로: 댓글 비율 — 오른쪽 위로 갈수록 양쪽 모두 활발한 영상입니다. 보라색 점은 댓글이 좋아요보다 상대적으로 활발한 영상입니다."
          >
            <ScatterGrid points={data.scatter} />
          </Section>

          <Section title="댓글이 유독 활발한 영상 Top 5" count={data.topComment.length} description="댓글 수 ÷ 조회수 기준 (조회수 100회 이상)">
            <RankBars
              color="#9b7ede"
              format={(v) => formatPct(v, 2)}
              items={data.topComment.map((row) => ({ label: row.label, value: row.value, sub: row.sub }))}
            />
          </Section>
        </>
      ) : (
        <div className="empty-state">참여도 데이터를 불러오는 중입니다.</div>
      )}
    </>
  )
}
