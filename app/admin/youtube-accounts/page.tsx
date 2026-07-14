'use client'

import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from '@/components/app-shell'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type YoutubeAccount = {
  id: string
  account_name: string
  api_key: string
  channel_id: string | null
  channel_name: string | null
  api_active?: boolean
  api_last_error?: string | null
  api_last_checked_at?: string | null
}

export default function AdminYoutubeAccountsPage() {
  const [items, setItems] = useState<YoutubeAccount[]>([])
  const [accountName, setAccountName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [channelId, setChannelId] = useState('')
  const [channelName, setChannelName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadAccounts = async () => {
    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const res = await fetch('/api/admin/youtube-accounts', {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data?.error || '유튜브 계정 조회 실패')
      return
    }
    setItems(data.items || [])
  }

  useEffect(() => {
    void loadAccounts()
  }, [])

  const save = async () => {
    setMessage('')
    setError('')

    if (!accountName.trim()) {
      setError('계정 이름을 입력해 주세요.')
      return
    }

    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const res = await fetch('/api/admin/youtube-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: session.access_token,
        accountName,
        apiKey: apiKey || null,
        channelId: channelId || null,
        channelName: channelName || null
      })
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data?.error || '유튜브 계정 저장 실패')
      return
    }

    setAccountName('')
    setApiKey('')
    setChannelId('')
    setChannelName('')
    setMessage('유튜브 계정이 저장되었습니다.')
    await loadAccounts()
  }

  const activateApi = async (youtubeAccountId: string) => {
    setMessage('')
    setError('')

    const supabase = createSupabaseBrowserClient()
    const {
      data: { session }
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const res = await fetch('/api/admin/youtube-accounts/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: session.access_token, youtubeAccountId })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data?.error || 'API 활성화 실패')
      await loadAccounts()
      return
    }

    setMessage('API가 활성화되었습니다.')
    await loadAccounts()
  }

  return (
    <AuthGuard requireAdmin>
      <AppShell title="유튜브 계정 관리" subtitle="여러 유튜브 계정을 계속 추가해 유튜버가 선택해서 통계를 연결할 수 있습니다.">
        <div className="grid grid-2">
          <div className="panel form-stack">
            <div className="panel-header">
              <div>
                <div className="panel-title">계정 등록 문서</div>
                <p className="panel-subtitle">관리자가 유튜브 계정 이름, API 키, 채널 정보를 문서처럼 정리해 추가합니다.</p>
              </div>
            </div>
            <div className="field">
              <label className="label">계정 이름 *</label>
              <input className="input" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">YouTube API 키 (선택)</label>
              <input className="input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">채널 ID (선택)</label>
              <input className="input" value={channelId} onChange={(e) => setChannelId(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">채널 이름 (선택)</label>
              <input className="input" value={channelName} onChange={(e) => setChannelName(e.target.value)} />
            </div>
            <button className="button" onClick={save}>유튜브 계정 추가</button>
            {message ? <div className="message-success small">{message}</div> : null}
            {error ? <div className="message-error small">{error}</div> : null}
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">등록된 유튜브 계정</div>
                <p className="panel-subtitle">현재 CRM에서 선택 가능한 계정 목록입니다.</p>
              </div>
            </div>
            <div className="list" style={{ marginTop: 16 }}>
              {items.length === 0 ? (
                <div className="empty-state">등록된 유튜브 계정이 없습니다.</div>
              ) : (
                items.map((item) => (
                  <div className="list-item" key={item.id}>
                    <div>{item.account_name}</div>
                    <div className="small muted">채널명: {item.channel_name || '-'}</div>
                    <div className="small muted">채널ID: {item.channel_id || '-'}</div>
                    <div className="small muted">
                      API 상태: {item.api_active ? '활성화됨' : '비활성'}
                      {item.api_last_error ? ` · 오류: ${item.api_last_error}` : ''}
                    </div>
                    <div className="small muted">API 키: {item.api_key ? `${item.api_key.slice(0, 4)}...${item.api_key.slice(-4)}` : '-'}</div>
                    <div className="toolbar" style={{ marginTop: 12 }}>
                      <button className="button secondary" onClick={() => activateApi(item.id)}>
                        API 활성화
                      </button>
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
