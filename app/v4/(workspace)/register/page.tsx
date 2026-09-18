'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/v4/app-shell'
import { EmptyState, FormatPill } from '@/components/v4/ui'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { fmtDateKst, fmtNumber, fmtRelative } from '@/lib/v4/format'

type MyVideo = {
  id: string
  title: string | null
  stock_name: string
  content_type: 'longform' | 'shortform'
  published_at: string | null
  created_at: string | null
  view_count: number | null
  like_count: number | null
  comment_count: number | null
  youtube_url: string | null
}

function isLikelyYoutubeUrl(value: string) {
  try {
    const url = new URL(value.trim())
    return /(^|\.)youtube\.com$/.test(url.hostname) || url.hostname === 'youtu.be'
  } catch {
    return false
  }
}

export default function VideoRegisterPage() {
  const { toast, showSuccess, showError } = useToast()
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [contentType, setContentType] = useState<'longform' | 'shortform'>('longform')
  const [stockName, setStockName] = useState('')
  const [contentCategory, setContentCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [items, setItems] = useState<MyVideo[]>([])
  const [loaded, setLoaded] = useState(false)

  const loadMine = async () => {
    const { ok, data } = await authedFetchJson<{ items?: MyVideo[]; error?: string }>('/api/videos/mine?page=1')
    setLoaded(true)
    if (!ok) {
      showError(data?.error || '내 영상 목록 조회 실패')
      return
    }
    setItems(data.items || [])
  }

  useEffect(() => {
    void loadMine()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    if (!youtubeUrl.trim()) {
      showError('유튜브 영상 주소를 입력해 주세요.')
      return
    }
    if (!isLikelyYoutubeUrl(youtubeUrl)) {
      showError('유튜브 영상 주소 형식이 아닙니다. (youtube.com 또는 youtu.be 링크)')
      return
    }
    if (!stockName.trim()) {
      showError('종목명을 입력해 주세요.')
      return
    }

    setSubmitting(true)
    try {
      const { ok, data } = await authedPostJson<{ error?: string }>('/api/videos/create', {
        youtubeUrl: youtubeUrl.trim(),
        contentType,
        stockName: stockName.trim(),
        contentCategory: contentCategory.trim() || null
      })
      if (!ok) {
        showError(data?.error || '영상 등록 실패')
        return
      }

      showSuccess('영상이 등록됐습니다. 조회수·댓글수·영상길이는 유튜브 API로 자동 반영되며, 성장 대시보드/콘텐츠 성과 랭킹에 바로 집계됩니다.')
      setYoutubeUrl('')
      setStockName('')
      setContentCategory('')
      setContentType('longform')
      await loadMine()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="영상 등록"
        subtitle="유튜브 URL과 종목명을 입력하면 조회수·좋아요·댓글수·영상길이가 자동으로 채워지고, 성장 대시보드와 콘텐츠 성과 랭킹에 즉시 반영됩니다."
      />
      <Toast toast={toast} />

      <div className="grid grid-2">
        <div className="panel form-stack">
          <div className="panel-header">
            <div>
              <div className="panel-title">등록 폼</div>
              <p className="panel-subtitle">업로드 완료 후 URL과 종목명만 입력하면 됩니다.</p>
            </div>
          </div>
          <div className="field">
            <label className="label">유튜브 영상 주소 *</label>
            <input
              className="input"
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit()
              }}
            />
          </div>
          <div className="field">
            <label className="label">콘텐츠 형식 *</label>
            <select className="select" value={contentType} onChange={(e) => setContentType(e.target.value as 'longform' | 'shortform')}>
              <option value="longform">롱폼</option>
              <option value="shortform">숏폼</option>
            </select>
          </div>
          <div className="field">
            <label className="label">종목명 *</label>
            <input className="input" placeholder="예: 삼성전자" value={stockName} onChange={(e) => setStockName(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">비고 (선택)</label>
            <input className="input" value={contentCategory} onChange={(e) => setContentCategory(e.target.value)} />
          </div>
          <button className="button" disabled={submitting} onClick={submit}>
            {submitting ? '등록 중...' : '영상 등록'}
          </button>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">내가 등록한 영상</div>
              <p className="panel-subtitle">최근 등록순. 제목을 누르면 유튜브로 이동합니다.</p>
            </div>
          </div>
          <div className="list" style={{ marginTop: 16 }}>
            {!loaded ? null : items.length === 0 ? (
              <EmptyState>아직 등록한 영상이 없습니다.</EmptyState>
            ) : (
              items.map((item) => (
                <div className="list-item" key={item.id}>
                  <div className="row-between" style={{ alignItems: 'flex-start' }}>
                    <div>
                      {item.youtube_url ? (
                        <a className="link" href={item.youtube_url} target="_blank" rel="noreferrer">
                          {item.title || '제목 없음'}
                        </a>
                      ) : (
                        <span>{item.title || '제목 없음'}</span>
                      )}
                      <div className="small muted" style={{ marginTop: 4 }}>
                        {item.stock_name} · <FormatPill contentType={item.content_type} /> · 게시 {fmtDateKst(item.published_at || item.created_at)}
                      </div>
                    </div>
                    <div className="small muted">{fmtRelative(item.created_at)}</div>
                  </div>
                  <div className="row" style={{ marginTop: 10, gap: 16 }}>
                    <span className="small">조회수 {fmtNumber(item.view_count)}</span>
                    <span className="small">좋아요 {fmtNumber(item.like_count)}</span>
                    <span className="small">댓글 {fmtNumber(item.comment_count)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
