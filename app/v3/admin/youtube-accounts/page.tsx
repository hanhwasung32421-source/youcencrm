'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/v3/app-shell'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'

type Account = {
  id: string
  account_name: string
  api_key: string
  channel_id: string | null
  channel_name: string | null
  is_active: boolean
  api_active: boolean
  api_last_error: string | null
  api_last_checked_at: string | null
}

type Draft = {
  account_name: string
  api_key: string
  channel_id: string
  channel_name: string
}

function toDraft(account: Account): Draft {
  return {
    account_name: account.account_name,
    api_key: account.api_key || '',
    channel_id: account.channel_id || '',
    channel_name: account.channel_name || ''
  }
}

export default function AdminYoutubeAccountsPage() {
  const [items, setItems] = useState<Account[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const { toast, showSuccess, showError } = useToast()

  const [newAccountName, setNewAccountName] = useState('')
  const [newApiKey, setNewApiKey] = useState('')
  const [creating, setCreating] = useState(false)

  const load = async () => {
    const { ok, data } = await authedFetchJson<{ items?: Account[]; error?: string }>('/api/admin/youtube-accounts')
    if (!ok) {
      showError(data?.error || '유튜브 계정 목록 조회 실패')
      return
    }
    const nextItems = data.items || []
    setItems(nextItems)
    setDrafts((prev) => {
      const next = { ...prev }
      for (const account of nextItems) {
        if (!next[account.id]) next[account.id] = toDraft(account)
      }
      return next
    })
  }

  useEffect(() => {
    void load()
  }, [])

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  const formatCheckedAt = (value: string | null) => {
    if (!value) return '확인 기록 없음'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString('ko-KR')
  }

  const save = async (account: Account) => {
    const draft = drafts[account.id] || toDraft(account)
    if (!draft.account_name.trim() || !draft.api_key.trim()) {
      showError('채널 이름과 API 키는 비워둘 수 없습니다.')
      return
    }

    setSavingId(account.id)
    try {
      const { ok, data } = await authedPostJson<{ error?: string; verified?: boolean }>('/api/admin/youtube-accounts', {
        id: account.id,
        accountName: draft.account_name.trim(),
        apiKey: draft.api_key.trim(),
        channelId: draft.channel_id.trim() || null,
        channelName: draft.channel_name.trim() || null
      })
      if (!ok) {
        showError(data?.error || '저장 실패')
        return
      }
      if (data.verified) {
        showSuccess('API 키가 확인되어 바로 적용되었습니다. 지금부터 등록되는 영상은 조회수/영상길이 등이 자동으로 채워집니다.')
      } else {
        showError(`저장은 됐지만 API 키 확인에 실패했습니다: ${data?.error || '알 수 없는 오류'}`)
      }
      await load()
    } finally {
      setSavingId(null)
    }
  }

  const createAccount = async () => {
    if (!newAccountName.trim() || !newApiKey.trim()) {
      showError('채널 이름과 API 키를 입력해 주세요.')
      return
    }

    setCreating(true)
    try {
      const { ok, data } = await authedPostJson<{ error?: string; verified?: boolean }>('/api/admin/youtube-accounts', {
        accountName: newAccountName.trim(),
        apiKey: newApiKey.trim()
      })
      if (!ok) {
        showError(data?.error || '채널 추가 실패')
        return
      }
      if (data.verified) {
        showSuccess('채널이 추가되고 API 키가 바로 적용되었습니다.')
      } else {
        showError(`채널은 추가됐지만 API 키 확인에 실패했습니다: ${data?.error || '알 수 없는 오류'}`)
      }
      setNewAccountName('')
      setNewApiKey('')
      await load()
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <PageHeader
        title="유튜브 계정 관리"
        subtitle="채널별 YouTube Data API 키를 등록하면 저장 즉시 확인 후 적용됩니다. 이후 등록되는 영상은 제목/조회수/좋아요/영상길이가 자동으로 채워집니다."
      />
      <Toast toast={toast} />

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">등록된 채널</div>
            <p className="panel-subtitle">API 키를 저장하면 즉시 유효성을 확인하고 적용합니다. 채널 ID/채널명은 API가 꺼져 있을 때만 쓰이는 참고용 값입니다.</p>
          </div>
        </div>

        <div className="list" style={{ marginTop: 16 }}>
          {items.length === 0 ? (
            <div className="empty-state">등록된 채널이 없습니다.</div>
          ) : (
            items.map((account) => {
              const draft = drafts[account.id] || toDraft(account)
              return (
                <div className="list-item" key={account.id}>
                  <div className="grid grid-2" style={{ gap: 12 }}>
                    <div className="field">
                      <label className="label">채널(계정) 이름</label>
                      <input
                        className="input"
                        value={draft.account_name}
                        onChange={(e) => updateDraft(account.id, { account_name: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label className="label">API 키</label>
                      <input
                        className="input"
                        type="password"
                        value={draft.api_key}
                        onChange={(e) => updateDraft(account.id, { api_key: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label className="label">채널 ID (선택)</label>
                      <input
                        className="input"
                        value={draft.channel_id}
                        onChange={(e) => updateDraft(account.id, { channel_id: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label className="label">채널명 (선택, 표시용)</label>
                      <input
                        className="input"
                        value={draft.channel_name}
                        onChange={(e) => updateDraft(account.id, { channel_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="row-between" style={{ marginTop: 12, alignItems: 'center' }}>
                    <div className="small muted">
                      상태: {account.api_active ? <span style={{ color: 'var(--success)' }}>API 연동됨</span> : <span style={{ color: 'var(--danger)' }}>미연동</span>}
                      {' · '}
                      {formatCheckedAt(account.api_last_checked_at)}
                      {account.api_last_error ? ` · 오류: ${account.api_last_error}` : ''}
                    </div>
                    <button className="button" disabled={savingId === account.id} onClick={() => save(account)}>
                      {savingId === account.id ? '저장 중...' : '저장 및 적용'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="panel soft" style={{ marginTop: 16 }}>
          <div className="panel-title">새 채널 추가</div>
          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <div className="field">
              <label className="label">채널(계정) 이름</label>
              <input className="input" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">API 키</label>
              <input className="input" type="password" value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} />
            </div>
          </div>
          <button className="button" style={{ marginTop: 12 }} disabled={creating} onClick={createAccount}>
            {creating ? '추가 중...' : '채널 추가'}
          </button>
        </div>
      </div>
    </>
  )
}
