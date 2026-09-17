'use client'

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'
import { PageLoading } from '@/components/page-loading'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson } from '@/lib/session/authed-fetch'

type ChannelRow = {
  accountId: string
  name: string
  isActive: boolean
  videoCount: number
  viewCount: number
  likeCount: number
  commentCount: number
}

const numberFormat = new Intl.NumberFormat('ko-KR')

export default function AdminChannelsPage() {
  const [rows, setRows] = useState<ChannelRow[]>([])
  const [unassignedCount, setUnassignedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const { toast, showError } = useToast()

  useEffect(() => {
    const load = async () => {
      try {
        const { ok, data } = await authedFetchJson<{
          rows?: ChannelRow[]
          unassignedCount?: number
          error?: string
        }>('/api/admin/channels/summary')
        if (!ok) {
          showError(data?.error || '채널 요약 조회 실패')
          return
        }
        setRows(data.rows || [])
        setUnassignedCount(data.unassignedCount || 0)
      } finally {
        setLoading(false)
      }
    }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totals = rows.reduce(
    (acc, row) => ({
      videoCount: acc.videoCount + row.videoCount,
      viewCount: acc.viewCount + row.viewCount,
      likeCount: acc.likeCount + row.likeCount,
      commentCount: acc.commentCount + row.commentCount
    }),
    { videoCount: 0, viewCount: 0, likeCount: 0, commentCount: 0 }
  )

  return (
    <AuthGuard requireAdmin>
      <AppShell title="채널 현황" subtitle="유튜브 계정(채널)별로 누적된 영상 통계를 합산해서 보여줍니다.">
        {loading ? <PageLoading text="채널 현황을 불러오는 중입니다..." /> : null}
        <Toast toast={toast} />

        <div className="grid grid-3" style={{ marginBottom: 16 }}>
          <div className="panel soft">
            <div className="panel-title">전체 채널</div>
            <div className="card-value">{rows.length}개</div>
          </div>
          <div className="panel soft">
            <div className="panel-title">누적 영상수</div>
            <div className="card-value">{numberFormat.format(totals.videoCount)}개</div>
          </div>
          <div className="panel soft">
            <div className="panel-title">누적 조회수</div>
            <div className="card-value">{numberFormat.format(totals.viewCount)}회</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">채널별 합계</div>
              <p className="panel-subtitle">
                조회수 합계 기준으로 정렬됩니다. 채널별 시계열 통계(일자별 추이)는 수집 파이프라인이 없어 아직 제공하지 않습니다.
              </p>
            </div>
          </div>

          <div className="data-table attendance-table-center" style={{ marginTop: 16 }}>
            <div className="data-table-header" style={{ gridTemplateColumns: '1.4fr 0.8fr 0.9fr 0.9fr 0.9fr 0.8fr' }}>
              <div>채널</div>
              <div className="dashboard-header-center">상태</div>
              <div className="data-right">영상수</div>
              <div className="data-right">조회수</div>
              <div className="data-right">좋아요</div>
              <div className="data-right">댓글</div>
            </div>
            {rows.length === 0 ? (
              <div className="data-table-row" style={{ gridTemplateColumns: '1.4fr 0.8fr 0.9fr 0.9fr 0.9fr 0.8fr' }}>
                <div className="muted">등록된 채널이 없습니다.</div>
                <div />
                <div />
                <div />
                <div />
                <div />
              </div>
            ) : (
              rows.map((row) => (
                <div
                  className="data-table-row"
                  key={row.accountId}
                  style={{ gridTemplateColumns: '1.4fr 0.8fr 0.9fr 0.9fr 0.9fr 0.8fr' }}
                >
                  <div>{row.name}</div>
                  <div
                    className={`attendance-status-badge ${row.isActive ? 'attendance-status-present' : 'attendance-status-empty'}`}
                  >
                    {row.isActive ? '활성' : '비활성'}
                  </div>
                  <div className="data-right">{numberFormat.format(row.videoCount)}</div>
                  <div className="data-right">{numberFormat.format(row.viewCount)}</div>
                  <div className="data-right">{numberFormat.format(row.likeCount)}</div>
                  <div className="data-right">{numberFormat.format(row.commentCount)}</div>
                </div>
              ))
            )}
          </div>

          {unassignedCount > 0 ? (
            <p className="small muted" style={{ marginTop: 12 }}>
              채널 정보가 연결되지 않은 영상 {numberFormat.format(unassignedCount)}건은 위 합계에서 제외되었습니다.
            </p>
          ) : null}
        </div>
      </AppShell>
    </AuthGuard>
  )
}
