'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader, useV5Me } from '@/components/v5/app-shell'
import { Badge, Donut, WidgetCard } from '@/components/v5/widget'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { SCORE_TIER_LABEL, type ScoreTier, type ScoreboardRow } from '@/lib/v5/types'

const TIER_COLOR: Record<ScoreTier, string> = {
  excellent: '#16a34a',
  good: '#4f46e5',
  fair: '#f59e0b',
  poor: '#dc2626'
}

function ScoreRow({ rank, row }: { rank: number; row: ScoreboardRow }) {
  return (
    <div className="list-item" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span className={`v5-rank-badge ${rank <= 3 ? 'top' : ''}`}>{rank}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="v5-video-title">{row.video.title || '(제목 없음)'}</div>
        <div className="small muted">
          {row.video.stock_name} · {row.video.owner_name || '담당자 미상'} · 조회수 {(row.video.view_count ?? 0).toLocaleString('ko-KR')}
        </div>
        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          <span className="small muted" style={{ width: 66 }}>
            조회속도
          </span>
          <div className="v5-score-track">
            <div className={`v5-score-bar ${row.tier}`} style={{ width: `${(row.viewVelocityScore / 45) * 100}%` }} />
          </div>
          <span className="small muted" style={{ width: 30, textAlign: 'right' }}>
            {row.viewVelocityScore}
          </span>
        </div>
        <div className="row" style={{ gap: 6, marginTop: 4 }}>
          <span className="small muted" style={{ width: 66 }}>
            참여율
          </span>
          <div className="v5-score-track">
            <div className={`v5-score-bar ${row.tier}`} style={{ width: `${(row.engagementScore / 35) * 100}%` }} />
          </div>
          <span className="small muted" style={{ width: 30, textAlign: 'right' }}>
            {row.engagementScore}
          </span>
        </div>
        <div className="row" style={{ gap: 6, marginTop: 4 }}>
          <span className="small muted" style={{ width: 66 }}>
            초기성장{!row.hasSnapshotData ? '*' : ''}
          </span>
          <div className="v5-score-track">
            <div className={`v5-score-bar ${row.tier}`} style={{ width: `${(row.earlyGrowthScore / 20) * 100}%` }} />
          </div>
          <span className="small muted" style={{ width: 30, textAlign: 'right' }}>
            {row.earlyGrowthScore}
          </span>
        </div>
      </div>
      <div style={{ textAlign: 'center', flex: 'none' }}>
        <div className="card-value" style={{ fontSize: 22 }}>
          {row.totalScore}
        </div>
        <Badge tone={row.tier === 'excellent' ? 'green' : row.tier === 'good' ? 'indigo' : row.tier === 'fair' ? 'amber' : 'red'}>
          {SCORE_TIER_LABEL[row.tier]}
        </Badge>
      </div>
    </div>
  )
}

export default function ScoreboardPage() {
  const me = useV5Me()
  const { toast, showSuccess, showError } = useToast()
  const [rows, setRows] = useState<ScoreboardRow[]>([])
  const [distribution, setDistribution] = useState<Array<{ tier: ScoreTier; count: number }>>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [limit, setLimit] = useState(20)

  const load = async () => {
    setLoading(true)
    const res = await authedFetchJson<{ items: ScoreboardRow[]; distribution: Array<{ tier: ScoreTier; count: number }> }>('/api/v5/scoreboard')
    if (res.ok) {
      setRows(res.data.items || [])
      setDistribution(res.data.distribution || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const onSync = async () => {
    setSyncing(true)
    try {
      const res = await authedPostJson<{ updated: number; failed: number; error?: string }>('/api/v5/sync-stats', {})
      if (!res.ok) {
        showError(res.data?.error || '통계 새로고침에 실패했습니다.')
        return
      }
      showSuccess(`${res.data.updated}건 통계를 새로고침했습니다.`)
      await load()
    } finally {
      setSyncing(false)
    }
  }

  const donutSegments = useMemo(
    () => distribution.map((d) => ({ label: SCORE_TIER_LABEL[d.tier], value: d.count, color: TIER_COLOR[d.tier] })),
    [distribution]
  )
  const total = distribution.reduce((s, d) => s + d.count, 0)
  const avgScore = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.totalScore, 0) / rows.length) : 0

  return (
    <>
      <PageHeader
        title="알고리즘 친화도 스코어보드"
        subtitle="조회 속도 · 참여율 · 초기 성장을 0~100점으로 정규화한 팀 리더보드입니다."
        actions={
          me?.isAdmin ? (
            <button className="button secondary" disabled={syncing} onClick={onSync}>
              {syncing ? '새로고침 중...' : '통계 새로고침'}
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <WidgetCard icon="◔" title="구간별 분포" subtitle={`전체 ${total.toLocaleString('ko-KR')}건`}>
          {total > 0 ? (
            <Donut segments={donutSegments} centerLabel="평균" centerValue={String(avgScore)} />
          ) : (
            <div className="empty-state">아직 등록된 영상이 없습니다.</div>
          )}
        </WidgetCard>
        <WidgetCard
          className="span-2"
          icon="Σ"
          title="점수 계산식"
          subtitle="가중치 합계 100점"
          footer={<span>* 초기성장은 게시 후 48시간 스냅샷이 없으면 중립값(10점)이 적용됩니다.</span>}
        >
          <ul className="list" style={{ gap: 6 }}>
            <li className="list-item" style={{ padding: '8px 10px' }}>
              조회 속도(0~45점) = 팀 내 "일평균 조회수" 백분위 순위 × 45
            </li>
            <li className="list-item" style={{ padding: '8px 10px' }}>
              참여율(0~35점) = 팀 내 "(좋아요+댓글)/조회수" 백분위 순위 × 35
            </li>
            <li className="list-item" style={{ padding: '8px 10px' }}>
              초기 성장(0~20점) = 게시 후 48시간 조회수 성장률 백분위 순위 × 20(스냅샷 있을 때만)
            </li>
          </ul>
        </WidgetCard>
      </div>

      <WidgetCard icon="🏆" title="리더보드" subtitle={`상위 ${Math.min(limit, rows.length)}건 표시 중`}>
        {loading ? (
          <div className="empty-state">불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">등록된 영상이 없습니다. 영상을 먼저 등록해 주세요.</div>
        ) : (
          <div className="list">
            {rows.slice(0, limit).map((row, i) => (
              <ScoreRow key={row.video.id} rank={i + 1} row={row} />
            ))}
          </div>
        )}
        {rows.length > limit ? (
          <button className="button secondary sm" style={{ marginTop: 12 }} onClick={() => setLimit((l) => l + 20)}>
            더 보기
          </button>
        ) : null}
      </WidgetCard>

      <Toast toast={toast} />
    </>
  )
}
