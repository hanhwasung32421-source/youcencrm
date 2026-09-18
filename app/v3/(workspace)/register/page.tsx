'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/v3/app-shell'
import { Toast, useToast } from '@/components/toast'
import { DocRow, DocTable, Section, StockTagInput, Tag, type DocColumn } from '@/components/v3/ui'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { isTodayKst } from '@/lib/v3/engagement'
import { formatDateTime, formatNumber } from '@/lib/v3/format'
import { SAMPLE_STOCK_NAMES } from '@/lib/v3/sample-data'

type ContentType = 'longform' | 'shortform'

type PreviewResponse = {
  title?: string
  channelName?: string
  thumbnailUrl?: string | null
  publishedAt?: string | null
  viewCount?: number
  error?: string
}

type MineVideo = {
  id: string
  title: string | null
  stock_name: string | null
  content_type: ContentType
  published_at: string | null
  view_count: number
  like_count: number
  comment_count: number
  youtube_url: string | null
  created_at: string
}

const TODAY_COLUMNS: DocColumn[] = [
  { key: 'time', label: '등록 시각', width: '90px' },
  { key: 'title', label: '영상', width: 'minmax(0, 1.8fr)' },
  { key: 'type', label: '형식', width: '70px' },
  { key: 'views', label: '조회수', width: '100px', align: 'right' }
]

export default function RegisterPage() {
  const { toast, showSuccess, showError } = useToast()

  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [contentType, setContentType] = useState<ContentType>('longform')
  const [stockName, setStockName] = useState('')
  const [contentCategory, setContentCategory] = useState('')

  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewToken = useRef(0)

  const [saving, setSaving] = useState(false)
  const [todayVideos, setTodayVideos] = useState<MineVideo[] | null>(null)
  const [recentFallback, setRecentFallback] = useState(false)

  const loadMine = useCallback(async () => {
    const { ok, data } = await authedFetchJson<{ items: MineVideo[] }>('/api/videos/mine?page=1')
    if (!ok) return
    const items = data.items || []
    const today = items.filter((v) => isTodayKst(v.created_at))
    if (today.length > 0) {
      setTodayVideos(today)
      setRecentFallback(false)
    } else {
      setTodayVideos(items.slice(0, 8))
      setRecentFallback(true)
    }
  }, [])

  useEffect(() => {
    void loadMine()
  }, [loadMine])

  const runPreview = useCallback(async (url: string) => {
    if (!url.trim()) {
      setPreview(null)
      return
    }
    const token = ++previewToken.current
    setPreviewLoading(true)
    try {
      const { ok, data } = await authedFetchJson<PreviewResponse>(`/api/v3/link-preview?url=${encodeURIComponent(url.trim())}`)
      if (token !== previewToken.current) return
      setPreview(ok ? data : { error: data?.error || '미리보기를 불러오지 못했습니다.' })
    } finally {
      if (token === previewToken.current) setPreviewLoading(false)
    }
  }, [])

  const onSubmit = async () => {
    if (!youtubeUrl.trim()) {
      showError('유튜브 영상 주소를 입력해 주세요.')
      return
    }
    if (!stockName.trim()) {
      showError('종목명을 입력해 주세요.')
      return
    }

    setSaving(true)
    try {
      const { ok, data } = await authedPostJson<{ error?: string }>('/api/videos/create', {
        youtubeUrl: youtubeUrl.trim(),
        contentType,
        stockName: stockName.trim(),
        contentCategory: contentCategory.trim() || undefined
      })
      if (!ok) {
        showError(data?.error || '영상 등록에 실패했습니다.')
        return
      }
      showSuccess('영상이 등록되었습니다.')
      setYoutubeUrl('')
      setStockName('')
      setContentCategory('')
      setPreview(null)
      await loadMine()
    } catch (e: any) {
      showError(e?.message || '영상 등록 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader icon="📥" title="영상 등록" subtitle="새 문서를 작성하듯, 유튜브 링크 하나로 오늘 올린 영상을 CRM에 기록합니다." />
      <Toast toast={toast} />

      <Section title="새 문서 작성" description="유튜브 주소를 입력하면 제목 · 채널 정보를 먼저 미리 보여줍니다.">
        <div className="v3-inline-form">
          <div className="field">
            <label className="label">유튜브 영상 주소</label>
            <input
              className="input"
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              disabled={saving}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              onBlur={(e) => void runPreview(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runPreview((e.target as HTMLInputElement).value)
              }}
            />
          </div>

          {previewLoading ? <div className="small muted">미리보기를 불러오는 중…</div> : null}

          {preview && !previewLoading ? (
            preview.error ? (
              <div className="message-error small">{preview.error}</div>
            ) : (
              <div className="v3-link-preview">
                {preview.thumbnailUrl ? (
                  <img className="v3-link-preview-thumb" src={preview.thumbnailUrl} alt="" />
                ) : (
                  <div className="v3-link-preview-thumb placeholder" aria-hidden>
                    ▶
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div className="v3-cell-main" style={{ whiteSpace: 'normal' }}>
                    {preview.title || '(제목을 불러오지 못했습니다)'}
                  </div>
                  <div className="v3-cell-sub">
                    {preview.channelName || '채널 정보 없음'}
                    {typeof preview.viewCount === 'number' ? ` · 현재 조회수 ${formatNumber(preview.viewCount)}회` : ''}
                  </div>
                </div>
              </div>
            )
          ) : null}

          <div className="v3-form-grid">
            <div className="field">
              <label className="label">형식</label>
              <select className="select" value={contentType} disabled={saving} onChange={(e) => setContentType(e.target.value as ContentType)}>
                <option value="longform">롱폼</option>
                <option value="shortform">숏폼</option>
              </select>
            </div>
            <div className="field">
              <label className="label">카테고리 메모(선택)</label>
              <input className="input" value={contentCategory} disabled={saving} onChange={(e) => setContentCategory(e.target.value)} placeholder="예: 실적 브리핑" />
            </div>
          </div>

          <div className="field">
            <label className="label">종목</label>
            <StockTagInput value={stockName} onChange={setStockName} suggestions={SAMPLE_STOCK_NAMES} disabled={saving} />
          </div>

          <button className="button" disabled={saving} onClick={onSubmit} style={{ justifySelf: 'start' }}>
            {saving ? '등록 중...' : '등록'}
          </button>
        </div>
      </Section>

      <Section title={recentFallback ? '최근 등록한 영상' : '오늘 등록한 영상'} count={todayVideos?.length ?? 0}>
        {recentFallback ? <p className="v3-section-desc" style={{ marginTop: -8 }}>오늘 등록한 영상이 아직 없어 최근 등록 목록을 보여줍니다.</p> : null}
        <DocTable columns={TODAY_COLUMNS} isEmpty={!todayVideos || todayVideos.length === 0} empty="등록된 영상이 없습니다.">
          {(todayVideos || []).map((video) => (
            <DocRow columns={TODAY_COLUMNS} key={video.id}>
              <div className="small muted">{formatDateTime(video.created_at).slice(-5)}</div>
              <div style={{ minWidth: 0 }}>
                {video.youtube_url ? (
                  <a className="v3-link" href={video.youtube_url} target="_blank" rel="noreferrer">
                    {video.title || video.stock_name || '(제목 없음)'}
                  </a>
                ) : (
                  video.title || video.stock_name || '(제목 없음)'
                )}
                {video.stock_name ? <div className="v3-cell-sub">{video.stock_name}</div> : null}
              </div>
              <div>
                <Tag tone={video.content_type === 'shortform' ? 'violet' : 'blue'}>{video.content_type === 'shortform' ? '숏폼' : '롱폼'}</Tag>
              </div>
              <div className="data-right">{formatNumber(video.view_count)}</div>
            </DocRow>
          ))}
        </DocTable>
      </Section>
    </>
  )
}
