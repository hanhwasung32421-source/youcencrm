'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/app-shell'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'

type VideoItem = {
  id: string
  title: string | null
  stock_name: string
  content_type: 'longform' | 'shortform'
  published_at: string | null
  view_count: number | null
  like_count: number | null
  comment_count: number | null
}

export default function CreatorVideosPage() {
  const [items, setItems] = useState<VideoItem[]>([])
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [contentType, setContentType] = useState<'longform' | 'shortform'>('longform')
  const [stockName, setStockName] = useState('')
  const [contentCategory, setContentCategory] = useState('')
  const { toast, showSuccess, showError } = useToast()
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ pageSize: 20, totalCount: 0 })

  const loadMyVideos = async (targetPage = page) => {
    const { ok, data } = await authedFetchJson<{
      items?: VideoItem[]
      pagination?: { page: number; pageSize: number; totalCount: number }
      error?: string
    }>(`/api/videos/mine?page=${targetPage}`)
    if (!ok) {
      showError(data?.error || '영상 목록 조회 실패')
      return
    }
    setItems(data.items || [])
    if (data.pagination) {
      setPagination({ pageSize: data.pagination.pageSize, totalCount: data.pagination.totalCount })
    }
  }

  useEffect(() => {
    void loadMyVideos(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalPages = Math.max(Math.ceil(pagination.totalCount / pagination.pageSize), 1)

  const goToPage = async (nextPage: number) => {
    setPage(nextPage)
    await loadMyVideos(nextPage)
  }

  const isLikelyYoutubeUrl = (value: string) => {
    try {
      const url = new URL(value.trim())
      return /(^|\.)youtube\.com$/.test(url.hostname) || url.hostname === 'youtu.be'
    } catch {
      return false
    }
  }

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
      showError('주요 종목명을 입력해 주세요.')
      return
    }

    setLoading(true)
    try {
      const { ok, data } = await authedPostJson<{ error?: string }>('/api/videos/create', {
        youtubeUrl,
        contentType,
        stockName,
        contentCategory: contentCategory || null
      })
      if (!ok) {
        showError(data?.error || '영상 저장 실패')
        return
      }

      showSuccess('영상이 CRM에 저장되었습니다. 업로드 날짜와 기본 통계도 자동 반영되었습니다.')
      setYoutubeUrl('')
      setContentType('longform')
      setStockName('')
      setContentCategory('')
      await loadMyVideos()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHeader title="영상 등록" subtitle="업로드 완료 후 URL과 기본 분류만 입력하면 업로드 시각과 통계가 자동 저장됩니다." />
        <Toast toast={toast} />
        <div className="grid grid-2">
          <div className="panel form-stack">
            <div className="panel-header">
              <div>
                <div className="panel-title">등록 문서 작성</div>
                <p className="panel-subtitle">계정 선택 후 영상 URL과 핵심 분류만 입력하면 CRM 문서가 생성됩니다.</p>
              </div>
            </div>
            <div className="panel soft">
              <div className="panel-title">연결 유튜브 계정</div>
              <p className="panel-subtitle" style={{ marginTop: 8 }}>
                개미들의 주식노트 계정이 자동으로 연결됩니다.
              </p>
            </div>
            <div className="field">
              <label className="label">유튜브 영상 주소 *</label>
              <input className="input" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">콘텐츠 형식 *</label>
              <select className="select" value={contentType} onChange={(e) => setContentType(e.target.value as 'longform' | 'shortform')}>
                <option value="longform">롱폼</option>
                <option value="shortform">숏폼</option>
              </select>
            </div>
            <div className="field">
              <label className="label">주요 종목명 *</label>
              <input className="input" value={stockName} onChange={(e) => setStockName(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">비고</label>
              <input className="input" value={contentCategory} onChange={(e) => setContentCategory(e.target.value)} />
            </div>
            <button className="button" disabled={loading} onClick={submit}>{loading ? '저장 중...' : '작성 버튼'}</button>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">최근 등록 영상</div>
                <p className="panel-subtitle">최근 문서처럼 쌓인 영상 기록과 통계 요약입니다.</p>
              </div>
            </div>
            <div className="list" style={{ marginTop: 16 }}>
              {items.length === 0 ? (
                <div className="empty-state">아직 등록된 영상이 없습니다.</div>
              ) : (
                items.map((item) => (
                  <div className="list-item" key={item.id}>
                    <div>{item.title || '제목 없음'}</div>
                    <div className="small muted">
                      {item.stock_name} · {item.content_type === 'longform' ? '롱폼' : '숏폼'}
                    </div>
                    <div className="small muted">
                      조회수 {item.view_count ?? 0} · 좋아요 {item.like_count ?? 0} · 댓글 {item.comment_count ?? 0}
                    </div>
                  </div>
                ))
              )}
            </div>
            {pagination.totalCount > pagination.pageSize ? (
              <div className="toolbar" style={{ marginTop: 16, justifyContent: 'center' }}>
                <button className="button secondary" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                  이전
                </button>
                <span className="small muted">
                  {page} / {totalPages} 페이지 · 총 {pagination.totalCount}건
                </span>
                <button className="button secondary" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                  다음
                </button>
              </div>
            ) : null}
          </div>
        </div>
    </>
  )
}
