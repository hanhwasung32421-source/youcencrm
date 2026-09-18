'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/v2/app-shell'
import { SampleBanner } from '@/components/v2/sample-banner'
import { useV2Me } from '@/components/v2/session-context'
import { KeywordStatusTag, PriorityTag } from '@/components/v2/tags'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { authedDeleteJson, authedPatchJson } from '@/lib/v2/client'
import { formatKstDateTime } from '@/lib/v2/dates'
import { V2_MISSING_TABLE_MESSAGE } from '@/lib/v2/tables'
import {
  KEYWORD_STATUSES,
  KEYWORD_STATUS_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  type KeywordRadarItem,
  type KeywordStatus,
  type KeywordsPayload,
  type Priority
} from '@/lib/v2/types'

type Form = { stockName: string; keyword: string; sourceUrl: string; priority: Priority }

const EMPTY: KeywordsPayload = { items: [], recentStocks: [] }

function initialForm(): Form {
  return { stockName: '', keyword: '', sourceUrl: '', priority: 'normal' }
}

function normalize(value: string) {
  return value.replace(/\s+/g, '').toLowerCase()
}

export default function KeywordsPage() {
  const me = useV2Me()
  const { toast, showSuccess, showError } = useToast()
  const [payload, setPayload] = useState<KeywordsPayload>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState<Form>(initialForm)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | KeywordStatus>('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    const { ok, data } = await authedFetchJson<KeywordsPayload>('/api/v2/keywords')
    setLoaded(true)
    if (!ok) {
      showError(data?.error || '키워드 레이더 조회 실패')
      return
    }
    setPayload(data)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const guardSample = () => {
    if (payload.sample) {
      showError(V2_MISSING_TABLE_MESSAGE)
      return true
    }
    return false
  }

  const recentHit = payload.recentStocks.find((r) => form.stockName.trim() && normalize(r.stock_name) === normalize(form.stockName))

  const create = async () => {
    if (!form.stockName.trim() || !form.keyword.trim()) {
      showError('종목명과 키워드를 입력해 주세요.')
      return
    }
    if (guardSample()) return
    setSaving(true)
    try {
      const { ok, data } = await authedPostJson<{ ok?: boolean; error?: string }>('/api/v2/keywords', {
        stockName: form.stockName.trim(),
        keyword: form.keyword.trim(),
        sourceUrl: form.sourceUrl.trim() || null,
        priority: form.priority
      })
      if (!ok) {
        showError(data?.error || '키워드 등록 실패')
        return
      }
      setForm(initialForm())
      showSuccess('키워드 레이더에 등록했습니다.')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (item: KeywordRadarItem, status: KeywordStatus) => {
    if (guardSample()) return
    setBusyId(item.id)
    try {
      const { ok, data } = await authedPatchJson<{ ok?: boolean; error?: string }>('/api/v2/keywords', { id: item.id, status })
      if (!ok) {
        showError(data?.error || '상태 변경 실패')
        return
      }
      showSuccess(`${item.stock_name} → ${KEYWORD_STATUS_LABELS[status]}`)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (item: KeywordRadarItem) => {
    if (guardSample()) return
    if (!window.confirm(`"${item.keyword}" 키워드를 삭제할까요?`)) return
    setBusyId(item.id)
    try {
      const { ok, data } = await authedDeleteJson<{ ok?: boolean; error?: string }>(`/api/v2/keywords?id=${item.id}`)
      if (!ok) {
        showError(data?.error || '삭제 실패')
        return
      }
      showSuccess('삭제했습니다.')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const items = filter === 'all' ? payload.items : payload.items.filter((item) => item.status === filter)
  const counts = KEYWORD_STATUSES.reduce<Record<string, number>>((acc, status) => {
    acc[status] = payload.items.filter((item) => item.status === status).length
    return acc
  }, {})

  return (
    <>
      <PageHeader title="키워드·트렌드 레이더" subtitle="지금 다뤄야 할 검색 키워드/이슈를 팀이 함께 쌓아두는 보드입니다." />
      <Toast toast={toast} />
      <SampleBanner show={payload.sample} />

      <div className="panel soft">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <div className="v2-section-title" style={{ margin: 0 }}>
            최근 7일 이미 다룬 종목 (등록 영상 기준)
          </div>
          <span className="small muted v2-mono">{payload.recentStocks.length}종목</span>
        </div>
        {payload.recentStocks.length === 0 ? (
          <div className="small muted">최근 7일 동안 등록된 영상이 없습니다.</div>
        ) : (
          <div className="v2-chips">
            {payload.recentStocks.slice(0, 30).map((r) => (
              <span key={r.stock_name} className={`v2-chip ${recentHit && recentHit.stock_name === r.stock_name ? 'hit' : ''}`} title={`마지막 ${formatKstDateTime(r.last_at)}`}>
                {r.stock_name}
                <b>{r.count}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">키워드 등록</div>
            <p className="panel-subtitle">누구나 등록할 수 있습니다. 이미 다룬 종목이면 아래 경고가 뜹니다 — 새 각도를 찾아보세요.</p>
          </div>
        </div>
        <div className="v2-form-grid">
          <div className="field">
            <label className="label">종목명 *</label>
            <input className="input compact" value={form.stockName} placeholder="예: SK하이닉스" onChange={(e) => setForm({ ...form, stockName: e.target.value })} />
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label className="label">키워드 *</label>
            <input className="input compact" value={form.keyword} placeholder="예: 엔비디아 실적 발표 후 시간외 급등" onChange={(e) => setForm({ ...form, keyword: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">근거 URL</label>
            <input className="input compact" value={form.sourceUrl} placeholder="https://" onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">우선순위</label>
            <select className="select compact" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <button className="button" disabled={saving} onClick={create}>
              {saving ? '등록 중...' : '레이더에 등록'}
            </button>
          </div>
        </div>
        {recentHit ? (
          <div className="small" style={{ marginTop: 10, color: '#fbbf24' }}>
            ⚠ {recentHit.stock_name}은(는) 최근 7일 동안 {recentHit.count}회 다뤘습니다 (마지막 {formatKstDateTime(recentHit.last_at)}). 다른 각도의 키워드인지 확인해 주세요.
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">레이더</div>
            <p className="panel-subtitle">대기 → 작업중 → 완료</p>
          </div>
          <div className="v2-seg">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
              전체 {payload.items.length}
            </button>
            {KEYWORD_STATUSES.map((status) => (
              <button key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>
                {KEYWORD_STATUS_LABELS[status]} {counts[status]}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="empty-state">{loaded ? '표시할 키워드가 없습니다.' : ''}</div>
        ) : (
          <div className="list">
            {items.map((item) => {
              const busy = busyId === item.id
              const canEdit = me.isAdmin || item.created_by === me.crmUserId
              return (
                <div className="list-item" key={item.id}>
                  <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="v2-card-title">
                        <span>{item.stock_name}</span>
                        <PriorityTag priority={item.priority} />
                        <KeywordStatusTag status={item.status} />
                      </div>
                      <div className="v2-card-issue" style={{ marginTop: 4 }}>
                        {item.keyword}
                      </div>
                      <div className="v2-card-meta" style={{ marginTop: 6 }}>
                        <span>등록 {item.created_by_name || '-'}</span>
                        <span>{formatKstDateTime(item.created_at)}</span>
                        {item.source_url ? (
                          <a className="link" href={item.source_url} target="_blank" rel="noreferrer">
                            근거 ↗
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <div className="v2-card-actions" style={{ justifyContent: 'flex-end' }}>
                      {canEdit && item.status !== 'in_progress' ? (
                        <button className="button secondary xs" disabled={busy} onClick={() => void setStatus(item, 'in_progress')}>
                          작업중으로
                        </button>
                      ) : null}
                      {canEdit && item.status !== 'done' ? (
                        <button className="button success xs" disabled={busy} onClick={() => void setStatus(item, 'done')}>
                          완료
                        </button>
                      ) : null}
                      {canEdit ? (
                        <button className="button secondary xs" disabled={busy} style={{ color: '#f87171' }} onClick={() => void remove(item)}>
                          삭제
                        </button>
                      ) : null}
                    </div>
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
