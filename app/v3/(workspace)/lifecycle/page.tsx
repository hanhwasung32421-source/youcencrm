'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/v3/app-shell'
import { Toast, useToast } from '@/components/toast'
import { Callout, EmptyState, Section, Tag } from '@/components/v3/ui'
import { LineGrowthChart, type GrowthPoint } from '@/components/v3/charts'
import { useV3Me } from '@/components/v3/auth-guard'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { formatDateTime, formatNumber } from '@/lib/v3/format'

type ListItem = {
  id: string
  title: string
  stockName: string | null
  contentType: 'longform' | 'shortform'
  viewCount: number | null
  publishedAt: string | null
  youtubeUrl: string | null
  snapshotCount: number
}

type ListResponse = { items: ListItem[]; staffOptions: { id: string; name: string }[] }

type DetailResponse = {
  video: { id: string; title: string; stockName: string | null; contentType: string; youtubeUrl: string | null; publishedAt: string | null; viewCount: number | null; lastSyncedAt: string | null }
  snapshots: { snapshotAt: string; viewCount: number; likeCount: number; commentCount: number; day: number }[]
  enough: boolean
}

export default function LifecyclePage() {
  const me = useV3Me()
  const { toast, showSuccess, showError } = useToast()
  const [staffId, setStaffId] = useState('')
  const [list, setList] = useState<ListResponse | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailResponse | null>(null)
  const [syncing, setSyncing] = useState(false)

  const loadList = useCallback(
    async (filter: string) => {
      const qs = filter ? `?staffId=${filter}` : ''
      const { ok, data } = await authedFetchJson<ListResponse>(`/api/v3/lifecycle${qs}`)
      if (!ok) {
        showError((data as any)?.error || '영상 목록 조회에 실패했습니다.')
        return
      }
      setList(data)
      if (!selectedId && data.items.length > 0) setSelectedId(data.items[0].id)
    },
    [showError, selectedId]
  )

  const loadDetail = useCallback(
    async (videoId: string) => {
      const { ok, data } = await authedFetchJson<DetailResponse>(`/api/v3/lifecycle?videoId=${videoId}`)
      if (!ok) {
        showError((data as any)?.error || '성장 곡선 조회에 실패했습니다.')
        return
      }
      setDetail(data)
    },
    [showError]
  )

  useEffect(() => {
    void loadList(staffId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId])

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const syncAll = async () => {
    setSyncing(true)
    try {
      const { ok, data } = await authedPostJson<{ updated: number; total: number; error?: string }>('/api/v3/lifecycle/sync', {})
      if (!ok) {
        showError(data?.error || '통계 새로고침에 실패했습니다.')
        return
      }
      showSuccess(`${data.updated}/${data.total}개 영상의 통계를 새로고침했습니다.`)
      await loadList(staffId)
      if (selectedId) await loadDetail(selectedId)
    } finally {
      setSyncing(false)
    }
  }

  const syncOne = async () => {
    if (!selectedId) return
    setSyncing(true)
    try {
      const { ok, data } = await authedPostJson<{ updated: number; error?: string }>('/api/v3/lifecycle/sync', { videoId: selectedId })
      if (!ok) {
        showError(data?.error || '통계 새로고침에 실패했습니다.')
        return
      }
      showSuccess('이 영상의 통계를 새로고침했습니다.')
      await loadDetail(selectedId)
      await loadList(staffId)
    } finally {
      setSyncing(false)
    }
  }

  const points: GrowthPoint[] = (detail?.snapshots || []).map((s) => ({ day: s.day, views: s.viewCount, snapshotAt: s.snapshotAt }))

  return (
    <>
      <PageHeader
        icon="📈"
        title="조회 성장 곡선"
        subtitle="게시 후 경과일에 따라 조회수가 어떻게 늘었는지, 아직 크고 있는지 정체됐는지를 봅니다."
        actions={
          <div className="row">
            {me?.isAdmin && list?.staffOptions?.length ? (
              <select className="select" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                <option value="">전체 팀</option>
                {list.staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button className="button secondary" disabled={syncing} onClick={syncAll}>
              {syncing ? '새로고침 중...' : '통계 새로고침(최근 영상)'}
            </button>
          </div>
        }
      />
      <Toast toast={toast} />

      <Section title="영상 선택" count={list?.items.length ?? 0}>
        {!list || list.items.length === 0 ? (
          <EmptyState>등록된 영상이 없습니다.</EmptyState>
        ) : (
          <div className="v3-picker-list">
            {list.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`v3-picker-item ${selectedId === item.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(item.id)}
              >
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title}
                  {item.stockName ? <span className="v3-cell-sub"> · {item.stockName}</span> : null}
                </span>
                <span className="row" style={{ flexShrink: 0 }}>
                  <Tag tone={item.contentType === 'shortform' ? 'violet' : 'blue'}>{item.contentType === 'shortform' ? '숏폼' : '롱폼'}</Tag>
                  <span className="small muted">스냅샷 {item.snapshotCount}개</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Section>

      {detail ? (
        <Section
          title={detail.video.title}
          description={`${detail.video.stockName || '종목 미상'} · 현재 조회수 ${formatNumber(detail.video.viewCount)}회 · 마지막 새로고침 ${formatDateTime(detail.video.lastSyncedAt)}`}
          actions={
            <button className="button secondary xs" disabled={syncing} onClick={syncOne}>
              이 영상만 새로고침
            </button>
          }
        >
          {detail.enough ? (
            <LineGrowthChart points={points} />
          ) : (
            <Callout icon="📭" tone="warning">
              스냅샷 부족 — 통계 새로고침을 몇 차례 실행하면 성장 곡선이 쌓입니다. (현재 {detail.snapshots.length}개)
            </Callout>
          )}
        </Section>
      ) : null}
    </>
  )
}
