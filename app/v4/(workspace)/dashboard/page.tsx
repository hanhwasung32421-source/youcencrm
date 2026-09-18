'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/v4/app-shell'
import { useV4Me } from '@/components/v4/me-context'
import { ProgressRing, ShareBar, TimelineChart } from '@/components/v4/charts'
import { EmptyState, KpiCard, PeriodToggle, SampleBanner } from '@/components/v4/ui'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import type { DailyPoint, Kpis, PeriodDays } from '@/lib/v4/analytics'
import { fmtCompact, fmtDateTimeKst, fmtNumber, fmtPercent, fmtRelative } from '@/lib/v4/format'

type FeedItem = {
  id: string
  title: string
  stockName: string
  ownerName: string
  contentType: string
  viewCount: number
  createdAt: string
  thumbnailUrl: string | null
  youtubeUrl: string
}

type DashboardResponse = {
  scope: 'admin' | 'staff'
  period: PeriodDays
  range: { start: string; end: string }
  staffCount: number
  targetPerDay: number
  kpis: Kpis
  daily: DailyPoint[]
  feed: FeedItem[]
  lastSyncedAt: string | null
  goal: {
    month: string
    scope: 'team' | 'user' | 'derived' | 'none'
    targetVideos: number
    targetViews: number
    actualVideos: number
    actualViews: number
    teamGoal: { targetVideos: number; targetViews: number } | null
    sample: boolean
  }
  error?: string
}

const GOAL_SCOPE_LABEL: Record<DashboardResponse['goal']['scope'], string> = {
  team: '팀 목표',
  user: '개인 목표',
  derived: '팀 목표 ÷ 인원 환산',
  none: '목표 미설정'
}

export default function GrowthDashboardPage() {
  const { isAdmin } = useV4Me()
  const { toast, showSuccess, showError } = useToast()
  const [period, setPeriod] = useState<PeriodDays>(30)
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const [goalVideos, setGoalVideos] = useState('')
  const [goalViews, setGoalViews] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)

  const load = useCallback(
    async (days: PeriodDays) => {
      setLoading(true)
      const { ok, data: res } = await authedFetchJson<DashboardResponse>(`/api/v4/dashboard?period=${days}`)
      setLoading(false)
      if (!ok || res?.error) {
        showError(res?.error || '대시보드 조회에 실패했습니다.')
        return
      }
      setData(res)
      if (res.goal.teamGoal) {
        setGoalVideos(String(res.goal.teamGoal.targetVideos))
        setGoalViews(String(res.goal.teamGoal.targetViews))
      }
    },
    [showError]
  )

  useEffect(() => {
    void load(period)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const syncStats = async () => {
    setSyncing(true)
    const { ok, data: res } = await authedPostJson<{ updated: number; failed: number; total: number; error?: string }>('/api/v4/sync-stats', {})
    setSyncing(false)
    if (!ok || res?.error) {
      showError(res?.error || '통계 새로고침에 실패했습니다.')
      return
    }
    showSuccess(`영상 ${fmtNumber(res.total)}개 중 ${fmtNumber(res.updated)}개 통계를 갱신했습니다.${res.failed ? ` (실패 ${res.failed})` : ''}`)
    void load(period)
  }

  const saveGoal = async () => {
    if (!data) return
    setSavingGoal(true)
    const { ok, data: res } = await authedPostJson<{ error?: string }>('/api/v4/goals', {
      month: data.goal.month,
      userId: null,
      targetVideos: Number(goalVideos || 0),
      targetViews: Number(goalViews || 0)
    })
    setSavingGoal(false)
    if (!ok || res?.error) {
      showError(res?.error || '목표 저장에 실패했습니다.')
      return
    }
    showSuccess('이번 달 팀 목표를 저장했습니다.')
    setGoalOpen(false)
    void load(period)
  }

  const kpis = data?.kpis
  const goal = data?.goal
  const videoRatio = goal && goal.targetVideos > 0 ? goal.actualVideos / goal.targetVideos : 0
  const viewRatio = goal && goal.targetViews > 0 ? goal.actualViews / goal.targetViews : 0

  return (
    <>
      <PageHeader
        title="성장 대시보드"
        subtitle={
          data
            ? `${data.range.start} ~ ${data.range.end} · ${data.scope === 'admin' ? `직원 ${fmtNumber(data.staffCount)}명 전체` : '내 영상'} 기준`
            : '기간별 조회수·업로드 흐름과 목표 달성률을 한눈에 봅니다.'
        }
        actions={
          <>
            <PeriodToggle value={period} onChange={setPeriod} disabled={loading} />
            {isAdmin ? (
              <button className="button" onClick={syncStats} disabled={syncing || loading}>
                {syncing ? '새로고침 중...' : '통계 새로고침'}
              </button>
            ) : null}
          </>
        }
      />
      <Toast toast={toast} />
      <SampleBanner show={Boolean(goal?.sample)} />

      <div className="row-between">
        <div className="v4-sync-meta">
          마지막 통계 동기화: {data?.lastSyncedAt ? `${fmtDateTimeKst(data.lastSyncedAt)} (${fmtRelative(data.lastSyncedAt)})` : '기록 없음'}
        </div>
        {isAdmin && data ? (
          <button className="button secondary" onClick={() => setGoalOpen((v) => !v)}>
            {goalOpen ? '목표 설정 닫기' : `${data.goal.month} 팀 목표 설정`}
          </button>
        ) : null}
      </div>

      {goalOpen && data ? (
        <div className="panel soft">
          <div className="panel-title">{data.goal.month} 팀 목표</div>
          <p className="panel-subtitle">이번 달 팀 전체가 달성할 영상 수와 조회수를 정합니다. 직원 화면에는 인원수로 나눈 값이 표시됩니다.</p>
          <div className="v4-goal-form" style={{ marginTop: 12 }}>
            <div className="field">
              <label className="label">월</label>
              <input className="input" value={data.goal.month} disabled />
            </div>
            <div className="field">
              <label className="label">목표 영상 수</label>
              <input className="input" type="number" min={0} value={goalVideos} onChange={(e) => setGoalVideos(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">목표 조회수</label>
              <input className="input" type="number" min={0} value={goalViews} onChange={(e) => setGoalViews(e.target.value)} />
            </div>
            <button className="button success" onClick={saveGoal} disabled={savingGoal}>
              {savingGoal ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-4">
        <KpiCard title="총 조회수" value={fmtNumber(kpis?.totalViews)} meta={`영상당 평균 ${fmtNumber(kpis?.avgViews)}회`} tone="indigo" />
        <KpiCard
          title="영상 수"
          value={fmtNumber(kpis?.videoCount)}
          meta={`하루 평균 ${data ? (kpis!.videoCount / data.period).toFixed(1) : '0'}개 · 목표 ${fmtNumber(data?.targetPerDay)}개/일`}
          tone="emerald"
        />
        <KpiCard title="좋아요율" value={fmtPercent(kpis?.likeRate)} meta={`좋아요 ${fmtNumber(kpis?.totalLikes)}개 / 조회수`} tone="amber" />
        <KpiCard title="댓글율" value={fmtPercent(kpis?.commentRate, 3)} meta={`댓글 ${fmtNumber(kpis?.totalComments)}개 / 조회수`} tone="rose" />
      </div>

      <div className="grid grid-3">
        <div className="panel" style={{ gridColumn: 'span 2' }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">일별 업로드 · 조회수 타임라인</div>
              <p className="panel-subtitle">막대는 그날 등록한 영상 수, 선은 그 영상들의 현재 누적 조회수입니다. 점선은 일일 업로드 목표(인원 × 12).</p>
            </div>
          </div>
          {data ? <TimelineChart points={data.daily} target={data.targetPerDay} /> : <EmptyState>불러오는 중입니다.</EmptyState>}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">{goal?.month || '이번 달'} 목표 대비</div>
              <p className="panel-subtitle">{goal ? GOAL_SCOPE_LABEL[goal.scope] : ''}</p>
            </div>
          </div>
          {goal && goal.scope !== 'none' ? (
            <div className="v4-ring-row">
              <ProgressRing value={videoRatio} label="영상 수" sublabel={`${fmtNumber(goal.actualVideos)} / ${fmtNumber(goal.targetVideos)}개`} />
              <ProgressRing value={viewRatio} label="조회수" sublabel={`${fmtCompact(goal.actualViews)} / ${fmtCompact(goal.targetViews)}`} color="#10b981" />
            </div>
          ) : (
            <EmptyState>
              {isAdmin ? '이번 달 팀 목표가 없습니다. 상단의 "팀 목표 설정"으로 등록해 주세요.' : '관리자가 팀 목표를 등록하면 개인 환산 목표가 표시됩니다.'}
            </EmptyState>
          )}
          <div style={{ marginTop: 16 }}>
            <div className="card-title" style={{ marginBottom: 8 }}>롱폼 vs 숏폼 비중</div>
            <ShareBar a={kpis?.longformCount || 0} b={kpis?.shortformCount || 0} />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">최근 등록 영상</div>
            <p className="panel-subtitle">가장 최근에 등록된 영상 20개. 제목을 누르면 유튜브에서 열립니다.</p>
          </div>
        </div>
        {data && data.feed.length === 0 ? <EmptyState>등록된 영상이 없습니다.</EmptyState> : null}
        {data && data.feed.length > 0 ? (
          <div className="v4-feed">
            {data.feed.map((item) => (
              <div className={`v4-feed-item ${item.contentType === 'shortform' ? 'short' : ''}`} key={item.id}>
                {item.thumbnailUrl ? (
                  <img className="v4-thumb" src={item.thumbnailUrl} alt="" loading="lazy" />
                ) : (
                  <div className="v4-thumb-placeholder">no thumb</div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div className="v4-feed-title">
                    {item.youtubeUrl ? (
                      <a href={item.youtubeUrl} target="_blank" rel="noopener noreferrer">
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </div>
                  <div className="v4-feed-meta">
                    <span>종목 {item.stockName}</span>
                    <span>담당 {item.ownerName}</span>
                    <span>{item.contentType === 'shortform' ? '숏폼' : '롱폼'}</span>
                  </div>
                </div>
                <div className="v4-feed-right">
                  <strong>{fmtNumber(item.viewCount)}회</strong>
                  {fmtRelative(item.createdAt)}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  )
}
