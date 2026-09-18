'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/v2/app-shell'
import { SampleBanner } from '@/components/v2/sample-banner'
import { ContentTypeTag } from '@/components/v2/tags'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { authedPatchJson } from '@/lib/v2/client'
import { formatKstDateTime } from '@/lib/v2/dates'
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  SEO_CHECKLIST_FIELDS,
  SEO_CHECKLIST_LABELS,
  checklistDoneCount,
  emptyChecklist,
  titleKeywordSuggestions,
  type ContentType,
  type MineVideoItem,
  type MineVideosPayload,
  type SeoChecklist,
  type SeoChecklistField
} from '@/lib/v2/types'

type Form = { youtubeUrl: string; contentType: ContentType; stockName: string; note: string }

function initialForm(): Form {
  return { youtubeUrl: '', contentType: 'longform', stockName: '', note: '' }
}

export default function RegisterPage() {
  const { toast, showSuccess, showError } = useToast()
  const [form, setForm] = useState<Form>(initialForm)
  const [saving, setSaving] = useState(false)
  const [videos, setVideos] = useState<MineVideoItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [checklists, setChecklists] = useState<Record<string, SeoChecklist>>({})
  const [checklistSample, setChecklistSample] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const suggestions = useMemo(() => titleKeywordSuggestions(form.stockName), [form.stockName])

  const loadChecklists = async (videoIds: string[]) => {
    if (videoIds.length === 0) {
      setChecklists({})
      return
    }
    const { ok, data } = await authedFetchJson<{ items: SeoChecklist[]; sample?: boolean }>(`/api/v2/seo-checklists?videoIds=${videoIds.join(',')}`)
    if (!ok) return
    setChecklistSample(Boolean(data.sample))
    const map: Record<string, SeoChecklist> = {}
    for (const item of data.items) map[item.video_id] = item
    setChecklists(map)
  }

  const load = async () => {
    const { ok, data } = await authedFetchJson<MineVideosPayload>('/api/videos/mine?page=1')
    setLoaded(true)
    if (!ok) {
      showError(data?.error || '내 등록 영상 조회 실패')
      return
    }
    setVideos(data.items)
    await loadChecklists(data.items.map((v) => v.id))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const register = async () => {
    if (!form.youtubeUrl.trim()) {
      showError('유튜브 URL을 입력해 주세요.')
      return
    }
    if (!form.stockName.trim()) {
      showError('종목명을 입력해 주세요.')
      return
    }
    setSaving(true)
    try {
      const { ok, data } = await authedPostJson<{ ok?: boolean; video?: { id: string }; error?: string }>('/api/videos/create', {
        youtubeUrl: form.youtubeUrl.trim(),
        contentType: form.contentType,
        stockName: form.stockName.trim(),
        contentCategory: form.note.trim() || null
      })
      if (!ok || !data.video) {
        showError(data?.error || '영상 등록 실패')
        return
      }
      // SEO 체크리스트 행을 기본값(false)으로 만들어 둔다. 테이블이 없으면 조용히 넘어간다.
      await authedPatchJson('/api/v2/seo-checklists', { videoId: data.video.id, patch: {} })
      showSuccess('영상을 등록했습니다. 아래 목록에서 SEO 체크리스트를 채워주세요.')
      setForm(initialForm())
      await load()
    } finally {
      setSaving(false)
    }
  }

  const toggleCheck = async (video: MineVideoItem, field: SeoChecklistField) => {
    const current = checklists[video.id] || emptyChecklist(video.id)
    const nextValue = !current[field]
    setBusyId(video.id)
    try {
      const { ok, data } = await authedPatchJson<{ ok?: boolean; item?: SeoChecklist; error?: string }>('/api/v2/seo-checklists', {
        videoId: video.id,
        patch: { [field]: nextValue }
      })
      if (!ok) {
        showError(data?.error || 'SEO 체크리스트 저장 실패')
        return
      }
      if (data.item) setChecklists((prev) => ({ ...prev, [video.id]: data.item as SeoChecklist }))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader title="영상 등록" subtitle="유튜브 URL을 등록하면서 발견성(SEO)을 바로 점검합니다. 등록 즉시 조회수·좋아요·댓글 수를 자동 수집합니다." />
      <Toast toast={toast} />

      <div className="grid grid-2">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">신규 등록</div>
              <p className="panel-subtitle">종목명을 입력하면 제목 키워드 패턴과 체크리스트가 아래에 표시됩니다.</p>
            </div>
          </div>
          <div className="form-stack">
            <div className="field">
              <label className="label">유튜브 URL *</label>
              <input className="input" placeholder="https://www.youtube.com/watch?v=..." value={form.youtubeUrl} onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })} />
            </div>
            <div className="v2-form-grid">
              <div className="field">
                <label className="label">형식</label>
                <select className="select compact" value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value as ContentType })}>
                  {CONTENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {CONTENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="label">종목명 *</label>
                <input className="input compact" placeholder="예: 삼성전자" value={form.stockName} onChange={(e) => setForm({ ...form, stockName: e.target.value })} />
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label className="label">비고</label>
                <input className="input compact" placeholder="내부 메모(선택)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
            <button className="button" disabled={saving} onClick={register}>
              {saving ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>

        <div className="panel soft">
          <div className="panel-header">
            <div>
              <div className="panel-title">SEO 가이드</div>
              <p className="panel-subtitle">게시 전 마지막 점검 — 저장되지 않는 참고용 안내입니다.</p>
            </div>
          </div>

          <div className="v2-section-title">제목 키워드 패턴</div>
          {suggestions.length === 0 ? (
            <div className="small muted">종목명을 입력하면 추천 제목 키워드가 표시됩니다.</div>
          ) : (
            <div className="v2-chips" style={{ marginBottom: 14 }}>
              {suggestions.map((s) => (
                <span className="v2-chip" key={s}>
                  {s}
                </span>
              ))}
            </div>
          )}

          <div className="v2-section-title">업로드 전 체크리스트</div>
          <div className="v2-checklist">
            {SEO_CHECKLIST_FIELDS.map((field) => (
              <div className="v2-check" key={field} style={{ cursor: 'default' }}>
                <input type="checkbox" disabled readOnly checked={false} />
                <span>{SEO_CHECKLIST_LABELS[field]}</span>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>
            등록 후 아래 목록에서 실제로 체크할 수 있습니다. 체크 결과는 최적화 보드·검색 성과 리포트 점수에 반영됩니다.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">내 등록 영상</div>
            <p className="panel-subtitle">최근 등록한 영상의 SEO 체크리스트를 여기서 바로 채울 수 있습니다.</p>
          </div>
        </div>
        <SampleBanner show={checklistSample} />

        {videos.length === 0 ? (
          <div className="empty-state">{loaded ? '등록한 영상이 없습니다.' : ''}</div>
        ) : (
          <div className="list">
            {videos.map((video) => {
              const checklist = checklists[video.id] || emptyChecklist(video.id)
              const done = checklistDoneCount(checklist)
              const busy = busyId === video.id
              return (
                <div className="list-item" key={video.id}>
                  <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="v2-card-title">
                        <span>{video.title || '(제목 수집 대기)'}</span>
                        <ContentTypeTag contentType={video.content_type} />
                      </div>
                      <div className="v2-card-meta" style={{ marginTop: 6 }}>
                        <span>{video.stock_name}</span>
                        <span>등록 {formatKstDateTime(video.created_at)}</span>
                        <span>조회 {(video.view_count ?? 0).toLocaleString('ko-KR')}</span>
                        <span>좋아요 {(video.like_count ?? 0).toLocaleString('ko-KR')}</span>
                        {video.youtube_url ? (
                          <a className="link" href={video.youtube_url} target="_blank" rel="noreferrer">
                            영상 ↗
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <span className={`pill ${done === 4 ? 'success' : done === 0 ? 'danger' : 'warning'}`}>체크리스트 {done}/4</span>
                  </div>
                  <div className="v2-checklist" style={{ marginTop: 10 }}>
                    {SEO_CHECKLIST_FIELDS.map((field) => (
                      <label className={`v2-check ${checklist[field] ? 'done' : ''}`} key={field}>
                        <input type="checkbox" checked={checklist[field]} disabled={busy} onChange={() => void toggleCheck(video, field)} />
                        <span>{SEO_CHECKLIST_LABELS[field]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
