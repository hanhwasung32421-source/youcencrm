'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/v2/app-shell'
import { SampleBanner } from '@/components/v2/sample-banner'
import { ContentTypeTag } from '@/components/v2/tags'
import { Toast, useToast } from '@/components/toast'
import { useV2Me } from '@/components/v2/session-context'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { formatKstDate } from '@/lib/v2/dates'
import { SEO_CHECKLIST_LABELS, checklistDoneCount, type OptimizationPayload, type OptimizationRow } from '@/lib/v2/types'

const EMPTY: OptimizationPayload = { items: [] }

function StarPicker({ value, onPick, disabled }: { value: number; onPick: (rating: number) => void; disabled?: boolean }) {
  return (
    <span className="v2-stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={`v2-star ${n <= value ? 'filled' : ''}`} disabled={disabled} onClick={() => onPick(n)} aria-label={`${n}점`}>
          ★
        </button>
      ))}
    </span>
  )
}

export default function OptimizationPage() {
  const me = useV2Me()
  const { toast, showSuccess, showError } = useToast()
  const [payload, setPayload] = useState<OptimizationPayload>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [draftRating, setDraftRating] = useState(3)
  const [draftNote, setDraftNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { ok, data } = await authedFetchJson<OptimizationPayload>('/api/v2/optimization')
    setLoaded(true)
    if (!ok) {
      showError(data?.error || '최적화 보드 조회 실패')
      return
    }
    setPayload(data)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openReview = (row: OptimizationRow) => {
    setOpenId(row.video.id)
    setDraftRating(row.latestReview?.rating || 3)
    setDraftNote('')
  }

  const submitReview = async (row: OptimizationRow) => {
    setSaving(true)
    try {
      const { ok, data } = await authedPostJson<{ ok?: boolean; error?: string }>('/api/v2/thumbnail-reviews', {
        videoId: row.video.id,
        rating: draftRating,
        note: draftNote.trim() || null
      })
      if (!ok) {
        showError(data?.error || '썸네일 평가 저장 실패')
        return
      }
      setOpenId(null)
      showSuccess('썸네일 평가를 저장했습니다.')
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="제목·썸네일 최적화 보드"
        subtitle={me.isAdmin ? '전체 담당자의 최근 등록 영상을 개선 필요 순으로 정렬합니다.' : '내가 등록한 영상을 개선 필요 순으로 정렬합니다.'}
      />
      <Toast toast={toast} />
      <SampleBanner show={payload.sample} />

      {payload.items.length === 0 ? (
        <div className="empty-state">{loaded ? '표시할 영상이 없습니다.' : ''}</div>
      ) : (
        <div className="list">
          {payload.items.map((row) => {
            const done = checklistDoneCount(row.checklist)
            return (
              <div className="list-item" key={row.video.id}>
                <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="v2-card-title">
                      <span>{row.video.title || '(제목 수집 대기)'}</span>
                      <ContentTypeTag contentType={row.video.content_type} />
                    </div>
                    <div className="v2-card-meta" style={{ marginTop: 6 }}>
                      <span>{row.video.stock_name}</span>
                      {me.isAdmin && row.video.owner_name ? <span>담당 {row.video.owner_name}</span> : null}
                      <span>발행 {formatKstDate(row.video.published_at)}</span>
                      <span>조회 {(row.video.view_count ?? 0).toLocaleString('ko-KR')}</span>
                    </div>
                  </div>
                  <span className={`pill ${row.improvementScore === 0 ? 'success' : row.improvementScore >= 3 ? 'danger' : 'warning'}`}>
                    개선 필요 {row.improvementScore}/4
                  </span>
                </div>

                <div className="grid grid-4" style={{ marginTop: 12, gap: 10 }}>
                  <div className="v2-check" style={{ cursor: 'default' }}>
                    <input type="checkbox" checked={row.titleLengthOk} disabled readOnly />
                    <span>제목 {row.titleLength}자 (60자 권장)</span>
                  </div>
                  <div className="v2-check" style={{ cursor: 'default' }}>
                    <input type="checkbox" checked={row.titleHasStock} disabled readOnly />
                    <span>제목에 종목명 포함</span>
                  </div>
                  <div className="v2-check" style={{ cursor: 'default' }}>
                    <input type="checkbox" checked={row.hasDescription} disabled readOnly />
                    <span>설명란 작성됨</span>
                  </div>
                  <div className="v2-check" style={{ cursor: 'default' }}>
                    <input type="checkbox" checked={done === 4} disabled readOnly />
                    <span>SEO 체크리스트 {done}/4</span>
                  </div>
                </div>

                <div className="row-between" style={{ marginTop: 12, flexWrap: 'wrap', gap: 10 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <span className="small muted">썸네일 클릭률 자가평가</span>
                    {row.latestReview ? (
                      <>
                        <StarPicker value={row.latestReview.rating} onPick={() => {}} disabled />
                        {row.latestReview.note ? <span className="small muted">“{row.latestReview.note}”</span> : null}
                      </>
                    ) : (
                      <span className="small muted">아직 평가 없음</span>
                    )}
                  </div>
                  <button className="button secondary xs" onClick={() => (openId === row.video.id ? setOpenId(null) : openReview(row))}>
                    {openId === row.video.id ? '닫기' : '평가하기'}
                  </button>
                </div>

                {openId === row.video.id ? (
                  <div className="v2-card-form" style={{ marginTop: 10 }}>
                    <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                      <StarPicker value={draftRating} onPick={setDraftRating} />
                      <input
                        className="input compact"
                        style={{ flex: 1 }}
                        placeholder="메모 (예: 텍스트 대비 약함)"
                        value={draftNote}
                        onChange={(e) => setDraftNote(e.target.value)}
                      />
                      <button className="button success xs" disabled={saving} onClick={() => void submitReview(row)}>
                        {saving ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="v2-card-meta" style={{ marginTop: 10 }}>
                  {Object.entries(SEO_CHECKLIST_LABELS).map(([field, label]) => {
                    const checked = Boolean(row.checklist[field as keyof typeof row.checklist])
                    return (
                      <span key={field} style={{ color: checked ? '#4ade80' : undefined }}>
                        {label} {checked ? '완료' : '미완료'}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
