'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/v3/app-shell'
import { Toast, useToast } from '@/components/toast'
import { Callout, EmptyState, Section, Tag } from '@/components/v3/ui'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { formatNumber } from '@/lib/v3/format'

type ViralItem = {
  id: string
  title: string
  stockName: string | null
  contentType: 'longform' | 'shortform'
  youtubeUrl: string | null
  viewCount: number | null
  velocity: number
  ratio: number
  note: string
  acknowledged: boolean
  actionNote: string | null
}

type ViralResponse = {
  insufficientData: boolean
  teamMedianVelocity: number
  teamSampleSize: number
  acksAvailable: boolean
  summary: string
  items: ViralItem[]
}

export default function ViralPage() {
  const { toast, showSuccess, showError } = useToast()
  const [data, setData] = useState<ViralResponse | null>(null)
  const [ackingId, setAckingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { ok, data } = await authedFetchJson<ViralResponse>('/api/v3/viral')
    if (!ok) {
      showError((data as any)?.error || '바이럴 신호 레이더 조회에 실패했습니다.')
      return
    }
    setData(data)
  }, [showError])

  useEffect(() => {
    void load()
  }, [load])

  const ack = async (id: string) => {
    setAckingId(id)
    try {
      const { ok, data } = await authedPostJson<{ error?: string }>('/api/v3/viral/ack', { videoId: id })
      if (!ok) {
        showError(data?.error || '확인 처리에 실패했습니다.')
        return
      }
      showSuccess('확인 처리했습니다.')
      setData((prev) => (prev ? { ...prev, items: prev.items.map((item) => (item.id === id ? { ...item, acknowledged: true } : item)) } : prev))
    } finally {
      setAckingId(null)
    }
  }

  return (
    <>
      <PageHeader icon="🔥" title="바이럴 신호 레이더" subtitle="조회 속도가 팀 중앙값보다 눈에 띄게 빠른 영상을 자동으로 잡아냅니다." />
      <Toast toast={toast} />

      {data ? (
        <>
          <Callout icon={data.insufficientData ? '📭' : '🔥'} tone={data.insufficientData ? 'warning' : 'success'}>
            {data.summary}
          </Callout>

          <div className="v3-kpi-grid">
            <div className="v3-kpi">
              <div className="v3-kpi-label">팀 중앙값 조회 속도</div>
              <div className="v3-kpi-value">{formatNumber(data.teamMedianVelocity)}회/일</div>
              <div className="v3-kpi-delta">최근 30일 게시 영상 기준</div>
            </div>
            <div className="v3-kpi">
              <div className="v3-kpi-label">표본 영상 수</div>
              <div className="v3-kpi-value">{formatNumber(data.teamSampleSize)}개</div>
            </div>
            <div className="v3-kpi">
              <div className="v3-kpi-label">바이럴 후보</div>
              <div className="v3-kpi-value">{formatNumber(data.items.length)}건</div>
              <div className="v3-kpi-delta">중앙값 대비 2배 이상</div>
            </div>
          </div>

          <Section title="바이럴 후보 피드" count={data.items.length}>
            {data.items.length === 0 ? (
              <EmptyState>현재 조건을 만족하는 영상이 없습니다.</EmptyState>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.items.map((item) => (
                  <div key={item.id} className={`v3-viral-card ${item.acknowledged ? 'acked' : ''}`}>
                    <div className="row-between">
                      <div style={{ minWidth: 0 }}>
                        <span aria-hidden>🔥</span>{' '}
                        {item.youtubeUrl ? (
                          <a className="v3-link" href={item.youtubeUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
                            {item.title}
                          </a>
                        ) : (
                          <strong>{item.title}</strong>
                        )}
                        <Tag tone={item.contentType === 'shortform' ? 'violet' : 'blue'}>{item.contentType === 'shortform' ? '숏폼' : '롱폼'}</Tag>
                      </div>
                      <div className="small muted" style={{ flexShrink: 0 }}>
                        조회수 {formatNumber(item.viewCount)}회 · 속도 {formatNumber(item.velocity)}회/일
                      </div>
                    </div>
                    <div className="small">{item.note}</div>
                    <div className="row-between">
                      <div className="small muted">{item.acknowledged ? `확인 완료${item.actionNote ? ` · ${item.actionNote}` : ''}` : '아직 확인 전'}</div>
                      {!item.acknowledged ? (
                        <button className="button secondary xs" disabled={ackingId === item.id} onClick={() => void ack(item.id)}>
                          {ackingId === item.id ? '처리 중...' : '봤음/조치함'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!data.acksAvailable ? (
              <p className="small muted">
                "봤음/조치함" 확인 기록은 <code>supabase/sql/v3/100_v3_engagement.sql</code> 실행 후 저장됩니다.
              </p>
            ) : null}
          </Section>
        </>
      ) : (
        <div className="empty-state">바이럴 신호를 계산하는 중입니다.</div>
      )}
    </>
  )
}
