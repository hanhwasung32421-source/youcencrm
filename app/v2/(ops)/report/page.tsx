'use client'

import { useEffect, useState } from 'react'
import { AdminOnly } from '@/components/v2/auth-guard'
import { PageHeader } from '@/components/v2/app-shell'
import { SampleBanner } from '@/components/v2/sample-banner'
import { ContentTypeTag } from '@/components/v2/tags'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson } from '@/lib/session/authed-fetch'
import { formatKstDate } from '@/lib/v2/dates'
import { LIKE_RATE_TARGET, VIEW_VELOCITY_TARGET_PER_DAY, type ReportPayload } from '@/lib/v2/types'

const EMPTY: ReportPayload = { items: [], insight: '' }
const GRID = '36px minmax(220px, 2fr) 110px 100px 90px 90px 90px 90px 70px'

function scoreTone(score: number) {
  if (score >= 70) return 'high'
  if (score >= 40) return ''
  return 'low'
}

function ReportBody() {
  const { toast, showError } = useToast()
  const [payload, setPayload] = useState<ReportPayload>(EMPTY)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const run = async () => {
      const { ok, data } = await authedFetchJson<ReportPayload>('/api/v2/report')
      setLoaded(true)
      if (!ok) {
        showError(data?.error || '검색 성과 리포트 조회 실패')
        return
      }
      setPayload(data)
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <PageHeader title="검색 성과 리포트" subtitle="조회 속도 40% + 좋아요율 30% + SEO 체크리스트 완료율 30%로 계산한 발견성 점수 리더보드입니다." />
      <Toast toast={toast} />
      <SampleBanner show={payload.sample} />

      {payload.insight ? <div className="v2-insight">{payload.insight}</div> : null}

      <div className="panel">
        <div className="v2-table" style={{ ['--cols' as any]: GRID }}>
          <div className="data-table-header">
            <div>#</div>
            <div>영상</div>
            <div>종목 / 담당자</div>
            <div>발행일</div>
            <div className="data-right">조회 속도</div>
            <div className="data-right">좋아요율</div>
            <div className="data-right">체크리스트</div>
            <div className="data-right">발견성 점수</div>
          </div>
          {payload.items.length === 0 ? (
            <div className="empty-state">{loaded ? '표시할 영상이 없습니다.' : ''}</div>
          ) : (
            payload.items.map((row, index) => (
              <div className="data-table-row" key={row.video.id}>
                <div>{index + 1}</div>
                <div className="v2-mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.video.title || ''}>
                  {row.video.title || '(제목 수집 대기)'} <ContentTypeTag contentType={row.video.content_type} />
                </div>
                <div>
                  {row.video.stock_name} · {row.ownerName}
                </div>
                <div>{formatKstDate(row.video.published_at)}</div>
                <div className="data-right">{Math.round(row.viewsPerDay).toLocaleString('ko-KR')}/일</div>
                <div className="data-right">{((row.video.view_count ? (row.video.like_count || 0) / row.video.view_count : 0) * 100).toFixed(1)}%</div>
                <div className="data-right">{row.checklistDone}/4</div>
                <div className="data-right">
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                    <span className="v2-mono" style={{ fontWeight: 700 }}>
                      {row.score}
                    </span>
                    <div className="v2-score-bar-track" style={{ width: 60 }}>
                      <div className={`v2-score-bar-fill ${scoreTone(row.score)}`} style={{ width: `${row.score}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>
          발견성 점수 = 조회 속도 점수(발행 후 하루 평균 조회수 ÷ {VIEW_VELOCITY_TARGET_PER_DAY.toLocaleString('ko-KR')} × 100, 100 상한) × 40% + 좋아요율 점수(좋아요율 ÷ {(LIKE_RATE_TARGET * 100).toFixed(0)}% × 100, 100 상한)
          × 30% + SEO 체크리스트 완료율 × 30%.
        </p>
      </div>
    </>
  )
}

export default function ReportPage() {
  return (
    <AdminOnly>
      <ReportBody />
    </AdminOnly>
  )
}
