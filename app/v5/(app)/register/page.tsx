'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/v5/app-shell'
import { WidgetCard, Badge } from '@/components/v5/widget'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { formatDate } from '@/lib/v5/format'

const STOCK_SUGGESTIONS = ['삼성전자', 'SK하이닉스', '에코프로', '현대차', 'LS머트리얼즈', '한미반도체', '알테오젠']

type MineVideo = {
  id: string
  title: string | null
  stock_name: string
  content_type: 'longform' | 'shortform'
  published_at: string | null
  view_count: number | null
  like_count: number | null
  comment_count: number | null
  youtube_url: string
  created_at: string
}

type PlaybookOption = { id: string; title: string; usage_count: number }

const CONTENT_TYPE_LABEL: Record<string, string> = { longform: '롱폼', shortform: '숏폼' }

function VideoCard({ video, justJoined }: { video: MineVideo; justJoined?: boolean }) {
  return (
    <WidgetCard
      className={justJoined ? 'v5-card-join' : ''}
      icon={CONTENT_TYPE_LABEL[video.content_type]?.slice(0, 1) || '·'}
      title={video.title || '(통계 수집 대기 중)'}
      subtitle={`${video.stock_name} · ${CONTENT_TYPE_LABEL[video.content_type] || video.content_type}`}
      footer={
        <>
          <span>{formatDate(video.published_at || video.created_at)}</span>
          <a href={video.youtube_url} target="_blank" rel="noreferrer">
            유튜브에서 보기 →
          </a>
        </>
      }
    >
      <div className="row-between">
        <span className="muted small">조회수</span>
        <span className="card-value" style={{ fontSize: 18 }}>
          {(video.view_count ?? 0).toLocaleString('ko-KR')}
        </span>
      </div>
      <div className="row-between small muted" style={{ marginTop: 6 }}>
        <span>좋아요 {(video.like_count ?? 0).toLocaleString('ko-KR')}</span>
        <span>댓글 {(video.comment_count ?? 0).toLocaleString('ko-KR')}</span>
      </div>
    </WidgetCard>
  )
}

export default function RegisterPage() {
  const { toast, showSuccess, showError } = useToast()
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [contentType, setContentType] = useState<'longform' | 'shortform'>('longform')
  const [stockName, setStockName] = useState('')
  const [contentCategory, setContentCategory] = useState('')
  const [playbookOptions, setPlaybookOptions] = useState<PlaybookOption[]>([])
  const [usedPlaybookId, setUsedPlaybookId] = useState('')
  const [saving, setSaving] = useState(false)

  const [items, setItems] = useState<MineVideo[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [justJoinedId, setJustJoinedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const loadMine = async (targetPage: number) => {
    setLoadingList(true)
    const res = await authedFetchJson<{ items: MineVideo[]; pagination: { page: number; pageSize: number; totalCount: number } }>(
      `/api/videos/mine?page=${targetPage}`
    )
    if (res.ok) {
      setItems(res.data.items || [])
      setTotalCount(res.data.pagination?.totalCount || 0)
    }
    setLoadingList(false)
  }

  useEffect(() => {
    void loadMine(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  useEffect(() => {
    const run = async () => {
      const res = await authedFetchJson<{ items: PlaybookOption[] }>('/api/v5/playbook')
      if (res.ok) setPlaybookOptions((res.data.items || []).slice(0, 20))
    }
    void run()
  }, [])

  const previewCard: MineVideo = useMemo(
    () => ({
      id: 'preview',
      title: youtubeUrl ? '등록하면 유튜브에서 제목 · 통계를 자동으로 가져옵니다' : '유튜브 주소를 입력하면 미리보기가 표시됩니다',
      stock_name: stockName || '종목명 미입력',
      content_type: contentType,
      published_at: null,
      view_count: null,
      like_count: null,
      comment_count: null,
      youtube_url: youtubeUrl || '#',
      created_at: new Date().toISOString()
    }),
    [youtubeUrl, stockName, contentType]
  )

  const canSubmit = youtubeUrl.trim().length > 0 && stockName.trim().length > 0 && !saving

  const onSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const res = await authedPostJson<{ ok: boolean; video: { id: string }; error?: string }>('/api/videos/create', {
        youtubeUrl: youtubeUrl.trim(),
        contentType,
        stockName: stockName.trim(),
        contentCategory: contentCategory.trim() || undefined
      })
      if (!res.ok) {
        showError((res.data as any)?.error || '영상 등록에 실패했습니다.')
        return
      }

      if (usedPlaybookId) {
        await authedPostJson(`/api/v5/playbook/${usedPlaybookId}/use`, {})
      }

      showSuccess('영상이 등록되었습니다.')
      setJustJoinedId(res.data.video.id)
      setYoutubeUrl('')
      setStockName('')
      setContentCategory('')
      setUsedPlaybookId('')
      if (page === 1) {
        await loadMine(1)
      } else {
        setPage(1)
      }
      window.setTimeout(() => setJustJoinedId(null), 900)
    } catch (e: any) {
      showError(e?.message || '영상 등록 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.max(Math.ceil(totalCount / 20), 1)

  return (
    <>
      <PageHeader title="영상 등록" subtitle="유튜브 영상 URL을 등록하면 조회수 · 좋아요 · 댓글 통계를 자동으로 가져옵니다." />

      <div className="grid grid-2" style={{ alignItems: 'start', gap: 20 }}>
        <WidgetCard icon="⬒" title="새 영상 등록" subtitle="필수: 유튜브 URL, 종목명">
          <div className="v5-form-grid">
            <div className="field full">
              <label className="label">유튜브 URL</label>
              <input
                className="input"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label">형식</label>
              <select className="select" value={contentType} onChange={(e) => setContentType(e.target.value as 'longform' | 'shortform')}>
                <option value="longform">롱폼</option>
                <option value="shortform">숏폼</option>
              </select>
            </div>
            <div className="field">
              <label className="label">종목명</label>
              <input className="input" list="v5-stock-suggestions" value={stockName} onChange={(e) => setStockName(e.target.value)} placeholder="예: 삼성전자" />
              <datalist id="v5-stock-suggestions">
                {STOCK_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="field full">
              <label className="label">콘텐츠 카테고리(선택)</label>
              <input className="input" value={contentCategory} onChange={(e) => setContentCategory(e.target.value)} placeholder="예: 실적분석, 급등주, 리포트" />
            </div>
            {playbookOptions.length > 0 ? (
              <div className="field full">
                <label className="label">사용한 발행 전략 패턴(선택)</label>
                <select className="select" value={usedPlaybookId} onChange={(e) => setUsedPlaybookId(e.target.value)}>
                  <option value="">선택 안 함</option>
                  {playbookOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} (사용 {p.usage_count}회)
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <button className="button" style={{ marginTop: 14 }} disabled={!canSubmit} onClick={onSubmit}>
            {saving ? '등록 중...' : '영상 등록'}
          </button>
        </WidgetCard>

        <div>
          <div className="small muted" style={{ marginBottom: 8 }}>
            미리보기
          </div>
          <VideoCard video={previewCard} />
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="row-between" style={{ marginBottom: 12 }}>
          <div className="panel-title" style={{ margin: 0 }}>
            내가 등록한 영상 <Badge tone="indigo">{totalCount.toLocaleString('ko-KR')}</Badge>
          </div>
          <div className="row">
            <button className="button secondary sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(p - 1, 1))}>
              이전
            </button>
            <span className="small muted">
              {page} / {totalPages}
            </span>
            <button className="button secondary sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(p + 1, totalPages))}>
              다음
            </button>
          </div>
        </div>

        {loadingList ? (
          <div className="empty-state">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">아직 등록한 영상이 없습니다. 위 폼으로 첫 영상을 등록해 보세요.</div>
        ) : (
          <div className="grid grid-3">
            {items.map((v) => (
              <VideoCard key={v.id} video={v} justJoined={v.id === justJoinedId} />
            ))}
          </div>
        )}
      </div>

      <Toast toast={toast} />
    </>
  )
}
