'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/v2/app-shell'
import { AdminOnly } from '@/components/v2/auth-guard'
import { SampleBanner } from '@/components/v2/sample-banner'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { formatKstDateTime } from '@/lib/v2/dates'
import { DEFAULT_DAILY_TARGET, V2_MISSING_TABLE_MESSAGE } from '@/lib/v2/tables'
import type { StaffTargetsPayload } from '@/lib/v2/types'

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

type AccountDraft = { account_name: string; api_key: string; channel_id: string; channel_name: string }

function toDraft(account: Account): AccountDraft {
  return {
    account_name: account.account_name,
    api_key: account.api_key || '',
    channel_id: account.channel_id || '',
    channel_name: account.channel_name || ''
  }
}

export default function SettingsYoutubeApiPage() {
  return (
    <AdminOnly>
      <SettingsContent />
    </AdminOnly>
  )
}

function SettingsContent() {
  const { toast, showSuccess, showError } = useToast()

  // 유튜브 API 계정 (공유 엔드포인트 /api/admin/youtube-accounts)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [drafts, setDrafts] = useState<Record<string, AccountDraft>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [newAccountName, setNewAccountName] = useState('')
  const [newApiKey, setNewApiKey] = useState('')
  const [creating, setCreating] = useState(false)
  const [revealId, setRevealId] = useState<string | null>(null)

  // 담당자 일일 목표 (V2 전용)
  const [targets, setTargets] = useState<StaffTargetsPayload>({ items: [] })
  const [targetDrafts, setTargetDrafts] = useState<Record<string, string>>({})
  const [savingTargetId, setSavingTargetId] = useState<string | null>(null)

  const loadAccounts = async () => {
    const { ok, data } = await authedFetchJson<{ items?: Account[]; error?: string }>('/api/admin/youtube-accounts')
    if (!ok) {
      showError(data?.error || '유튜브 계정 목록 조회 실패')
      return
    }
    const items = data.items || []
    setAccounts(items)
    setDrafts((prev) => {
      const next = { ...prev }
      for (const account of items) if (!next[account.id]) next[account.id] = toDraft(account)
      return next
    })
  }

  const loadTargets = async () => {
    const { ok, data } = await authedFetchJson<StaffTargetsPayload & { error?: string }>('/api/v2/staff-targets')
    if (!ok) {
      showError(data?.error || '일일 목표 조회 실패')
      return
    }
    setTargets(data)
    setTargetDrafts((prev) => {
      const next = { ...prev }
      for (const row of data.items) if (next[row.userId] === undefined) next[row.userId] = String(row.dailyTarget)
      return next
    })
  }

  useEffect(() => {
    void loadAccounts()
    void loadTargets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateDraft = (id: string, patch: Partial<AccountDraft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  const saveAccount = async (account: Account) => {
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
      if (data.verified) showSuccess('API 키가 확인되어 바로 적용되었습니다. 완료 처리 시 조회수·영상 길이가 자동으로 채워집니다.')
      else showError(`저장은 됐지만 API 키 확인에 실패했습니다: ${data?.error || '알 수 없는 오류'}`)
      await loadAccounts()
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
      if (data.verified) showSuccess('채널이 추가되고 API 키가 바로 적용되었습니다.')
      else showError(`채널은 추가됐지만 API 키 확인에 실패했습니다: ${data?.error || '알 수 없는 오류'}`)
      setNewAccountName('')
      setNewApiKey('')
      await loadAccounts()
    } finally {
      setCreating(false)
    }
  }

  const saveTarget = async (userId: string) => {
    if (targets.sample) {
      showError(V2_MISSING_TABLE_MESSAGE)
      return
    }
    const value = Number(targetDrafts[userId])
    if (!Number.isInteger(value) || value < 0) {
      showError('목표는 0 이상의 정수여야 합니다.')
      return
    }
    setSavingTargetId(userId)
    try {
      const { ok, data } = await authedPostJson<{ ok?: boolean; error?: string }>('/api/v2/staff-targets', { userId, dailyTarget: value })
      if (!ok) {
        showError(data?.error || '일일 목표 저장 실패')
        return
      }
      showSuccess('일일 목표를 저장했습니다.')
      await loadTargets()
    } finally {
      setSavingTargetId(null)
    }
  }

  const activeCount = accounts.filter((a) => a.api_active).length

  return (
    <>
      <PageHeader
        title="설정 › 유튜브 API 연동"
        subtitle="YouTube Data API 키를 등록하면 저장 즉시 검증 후 적용됩니다. 제작 보드에서 완료 처리(유튜브 URL 입력)할 때 제목·조회수·좋아요·영상 길이가 자동으로 채워집니다."
      />
      <Toast toast={toast} />

      <div className="v2-kpi-strip">
        <div className={`v2-kpi ${activeCount > 0 ? 'good' : 'bad'}`}>
          <div className="v2-kpi-label">API 연동 상태</div>
          <div className="v2-kpi-value">{activeCount > 0 ? 'LIVE' : 'OFF'}</div>
          <div className="v2-kpi-meta">
            {activeCount}/{accounts.length} 계정 활성
          </div>
        </div>
        <div className="v2-kpi">
          <div className="v2-kpi-label">등록 계정</div>
          <div className="v2-kpi-value">
            {accounts.length}
            <span className="unit">개</span>
          </div>
          <div className="v2-kpi-meta">채널별 API 키</div>
        </div>
        <div className="v2-kpi">
          <div className="v2-kpi-label">담당자</div>
          <div className="v2-kpi-value">
            {targets.items.length}
            <span className="unit">명</span>
          </div>
          <div className="v2-kpi-meta">일일 목표 설정 대상</div>
        </div>
        <div className="v2-kpi">
          <div className="v2-kpi-label">팀 일일 목표</div>
          <div className="v2-kpi-value">
            {targets.items.reduce((sum, r) => sum + r.dailyTarget, 0)}
            <span className="unit">편</span>
          </div>
          <div className="v2-kpi-meta">기본값 {DEFAULT_DAILY_TARGET}편/인</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">등록된 채널 / API 키</div>
            <p className="panel-subtitle">채널 ID·채널명은 API가 꺼져 있을 때 영상 등록에 쓰이는 참고값입니다.</p>
          </div>
        </div>
        <div className="list">
          {accounts.length === 0 ? (
            <div className="empty-state">등록된 채널이 없습니다. 아래에서 채널을 추가해 주세요.</div>
          ) : (
            accounts.map((account) => {
              const draft = drafts[account.id] || toDraft(account)
              return (
                <div className="list-item" key={account.id}>
                  <div className="row-between" style={{ marginBottom: 10 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className={`v2-status-dot ${account.api_active ? 'on' : 'off'}`} />
                      <span style={{ fontWeight: 700 }}>{account.account_name}</span>
                      <span className={`v2-tag ${account.api_active ? 'ok' : 'late'}`}>{account.api_active ? 'API 연동됨' : '미연동'}</span>
                    </div>
                    <span className="small muted v2-mono">
                      확인 {account.api_last_checked_at ? formatKstDateTime(account.api_last_checked_at) : '기록 없음'}
                    </span>
                  </div>
                  <div className="grid grid-2" style={{ gap: 12 }}>
                    <div className="field">
                      <label className="label">채널(계정) 이름</label>
                      <input className="input compact" value={draft.account_name} onChange={(e) => updateDraft(account.id, { account_name: e.target.value })} />
                    </div>
                    <div className="field">
                      <label className="label">API 키</label>
                      <div className="row" style={{ gap: 6 }}>
                        <input
                          className="input compact"
                          type={revealId === account.id ? 'text' : 'password'}
                          value={draft.api_key}
                          onChange={(e) => updateDraft(account.id, { api_key: e.target.value })}
                        />
                        <button className="button secondary xs" type="button" onClick={() => setRevealId((prev) => (prev === account.id ? null : account.id))}>
                          {revealId === account.id ? '숨김' : '보기'}
                        </button>
                      </div>
                    </div>
                    <div className="field">
                      <label className="label">채널 ID (선택)</label>
                      <input className="input compact" value={draft.channel_id} onChange={(e) => updateDraft(account.id, { channel_id: e.target.value })} />
                    </div>
                    <div className="field">
                      <label className="label">채널명 (선택, 표시용)</label>
                      <input className="input compact" value={draft.channel_name} onChange={(e) => updateDraft(account.id, { channel_name: e.target.value })} />
                    </div>
                  </div>
                  <div className="row-between" style={{ marginTop: 12 }}>
                    <div className="small muted">{account.api_last_error ? `마지막 오류: ${account.api_last_error}` : '오류 없음'}</div>
                    <button className="button" disabled={savingId === account.id} onClick={() => void saveAccount(account)}>
                      {savingId === account.id ? '저장 중...' : '저장 및 검증'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="panel soft" style={{ marginTop: 16 }}>
          <div className="panel-title">새 채널 추가</div>
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div className="field">
              <label className="label">채널(계정) 이름</label>
              <input className="input compact" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">API 키</label>
              <input className="input compact" type="password" value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} />
            </div>
          </div>
          <button className="button" style={{ marginTop: 12 }} disabled={creating} onClick={createAccount}>
            {creating ? '추가 중...' : '채널 추가'}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">담당자 일일 목표</div>
            <p className="panel-subtitle">제작 보드 KPI와 워크로드의 "완료 / 목표" 분모입니다. 기본 {DEFAULT_DAILY_TARGET}편.</p>
          </div>
        </div>
        <SampleBanner show={targets.sample} />
        {targets.items.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 12 }}>
            활성 직원이 없습니다.
          </div>
        ) : (
          <div className="data-table v2-table" style={{ '--cols': '1.4fr 0.8fr 0.6fr', '--minw': '420px', marginTop: targets.sample ? 12 : 0 } as React.CSSProperties}>
            <div className="data-table-header">
              <div>담당자</div>
              <div className="data-right">일일 목표 (편)</div>
              <div className="data-right">저장</div>
            </div>
            {targets.items.map((row) => (
              <div className="data-table-row" key={row.userId}>
                <div style={{ fontWeight: 700 }}>{row.name}</div>
                <div className="data-right">
                  <input
                    className="input compact v2-mono"
                    type="number"
                    min={0}
                    max={200}
                    style={{ maxWidth: 110, marginLeft: 'auto', textAlign: 'right' }}
                    value={targetDrafts[row.userId] ?? String(row.dailyTarget)}
                    onChange={(e) => setTargetDrafts((prev) => ({ ...prev, [row.userId]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveTarget(row.userId)
                    }}
                  />
                </div>
                <div className="data-right">
                  <button className="button xs" disabled={savingTargetId === row.userId} onClick={() => void saveTarget(row.userId)}>
                    {savingTargetId === row.userId ? '저장 중' : '저장'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
