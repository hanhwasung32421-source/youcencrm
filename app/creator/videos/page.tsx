'use client'

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type YoutubeAccountItem = {
  id: string
  account_name: string
  channel_id: string | null
  channel_name: string | null
}

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
  const [youtubeAccounts, setYoutubeAccounts] = useState<YoutubeAccountItem[]>([])
  const [items, setItems] = useState<VideoItem[]>([])
  const [youtubeAccountId, setYoutubeAccountId] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [contentType, setContentType] = useState<'longform' | 'shortform'>('longform')
  const [stockName, setStockName] = useState('')
  const [contentCategory, setContentCategory] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const getAccessToken = async () => {
    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const loadYoutubeAccounts = async () => {
    const accessToken = await getAccessToken()
    if (!accessToken) return
    const res = await fetch('/api/youtube-accounts/available', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data?.error || '유튜브 계정 목록 조회 실패')
      return
    }
    setYoutubeAccounts(data.items || [])
    if (!youtubeAccountId && data.items?.[0]?.id) {
      setYoutubeAccountId(data.items[0].id)
    }
  }

  const loadMyVideos = async () => {
    const accessToken = await getAccessToken()
    if (!accessToken) return
    const res = await fetch('/api/videos/mine', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data?.error || '영상 목록 조회 실패')
      return
    }
    setItems(data.items || [])
  }

  useEffect(() => {
    void loadYoutubeAccounts()
    void loadMyVideos()
  }, [])

  const submit = async () => {
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const accessToken = await getAccessToken()
      const res = await fetch('/api/videos/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          youtubeAccountId,
          youtubeUrl,
          contentType,
          stockName,
          contentCategory: contentCategory || null
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || '영상 저장 실패')
        return
      }

      setMessage('영상이 CRM에 저장되었습니다. 업로드 날짜와 기본 통계도 자동 반영되었습니다.')
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
    <AuthGuard>
      <AppShell title="영상 등록" subtitle="업로드 완료 후 URL과 기본 분류만 입력하면 업로드 시각과 통계가 자동 저장됩니다.">
        <div className="grid grid-2">
          <div className="panel form-stack">
            <div className="field">
              <label className="label">유튜브 계정 선택</label>
              <select className="select" value={youtubeAccountId} onChange={(e) => setYoutubeAccountId(e.target.value)}>
                <option value="">유튜브 계정을 선택하세요</option>
                {youtubeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.account_name}{account.channel_name ? ` · ${account.channel_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">유튜브 영상 주소</label>
              <input className="input" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">콘텐츠 형식</label>
              <select className="select" value={contentType} onChange={(e) => setContentType(e.target.value as 'longform' | 'shortform')}>
                <option value="longform">롱폼</option>
                <option value="shortform">숏폼</option>
              </select>
            </div>
            <div className="field">
              <label className="label">주요 종목명</label>
              <input className="input" value={stockName} onChange={(e) => setStockName(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">카테고리</label>
              <input className="input" value={contentCategory} onChange={(e) => setContentCategory(e.target.value)} />
            </div>
            <button className="button" disabled={loading} onClick={submit}>작성 버튼</button>
            {message ? <div className="message-success small">{message}</div> : null}
            {error ? <div className="message-error small">{error}</div> : null}
          </div>

          <div className="panel">
            <div className="card-title">최근 등록 영상</div>
            <div className="list" style={{ marginTop: 16 }}>
              {items.length === 0 ? (
                <div className="muted">아직 등록된 영상이 없습니다.</div>
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
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  )
}

