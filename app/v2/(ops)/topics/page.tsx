'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/v2/app-shell'
import { SampleBanner } from '@/components/v2/sample-banner'
import { useV2Me } from '@/components/v2/session-context'
import { PriorityTag, TopicStatusTag } from '@/components/v2/tags'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { authedDeleteJson, authedPatchJson } from '@/lib/v2/client'
import { formatKstDateTime, isoToLocalInput, localInputToIso, todayAtKst } from '@/lib/v2/dates'
import { V2_MISSING_TABLE_MESSAGE } from '@/lib/v2/tables'
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  TOPIC_STATUSES,
  TOPIC_STATUS_LABELS,
  type ContentType,
  type Priority,
  type TopicItem,
  type TopicStatus,
  type TopicsPayload
} from '@/lib/v2/types'

type TopicForm = { stockName: string; issueSummary: string; sourceUrl: string; urgency: Priority }
type AssignDraft = { assigneeUserId: string; contentType: ContentType; dueAt: string; priority: Priority }

const EMPTY: TopicsPayload = { items: [], recentStocks: [], staff: [] }

function initialForm(): TopicForm {
  return { stockName: '', issueSummary: '', sourceUrl: '', urgency: 'normal' }
}

function normalize(value: string) {
  return value.replace(/\s+/g, '').toLowerCase()
}

export default function TopicsPage() {
  const me = useV2Me()
  const { toast, showSuccess, showError } = useToast()
  const [payload, setPayload] = useState<TopicsPayload>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState<TopicForm>(initialForm)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | TopicStatus>('all')
  const [assignId, setAssignId] = useState<string | null>(null)
  const [assignDraft, setAssignDraft] = useState<AssignDraft>({ assigneeUserId: '', contentType: 'longform', dueAt: isoToLocalInput(todayAtKst(18)), priority: 'normal' })
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    const { ok, data } = await authedFetchJson<TopicsPayload & { error?: string }>('/api/v2/topics')
    setLoaded(true)
    if (!ok) {
      showError(data?.error || '종목·이슈 큐 조회 실패')
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
    if (!form.stockName.trim()) {
      showError('종목명을 입력해 주세요.')
      return
    }
    if (guardSample()) return
    setSaving(true)
    try {
      const { ok, data } = await authedPostJson<{ ok?: boolean; error?: string }>('/api/v2/topics', {
        stockName: form.stockName.trim(),
        issueSummary: form.issueSummary.trim() || null,
        sourceUrl: form.sourceUrl.trim() || null,
        urgency: form.urgency
      })
      if (!ok) {
        showError(data?.error || '이슈 등록 실패')
        return
      }
      setForm(initialForm())
      showSuccess('큐에 이슈를 등록했습니다.')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const openAssign = (topic: TopicItem) => {
    setAssignId(topic.id)
    setAssignDraft({
      assigneeUserId: payload.staff[0]?.id || '',
      contentType: 'longform',
      dueAt: isoToLocalInput(todayAtKst(18)),
      priority: topic.urgency
    })
  }

  const assign = async (topic: TopicItem) => {
    if (!assignDraft.assigneeUserId) {
      showError('담당자를 선택해 주세요.')
      return
    }
    if (guardSample()) return
    setBusyId(topic.id)
    try {
      const { ok, data } = await authedPostJson<{ ok?: boolean; error?: string }>('/api/v2/topics/assign', {
        topicId: topic.id,
        assigneeUserId: assignDraft.assigneeUserId,
        contentType: assignDraft.contentType,
        priority: assignDraft.priority,
        dueAt: localInputToIso(assignDraft.dueAt)
      })
      if (!ok) {
        showError(data?.error || '배정 실패')
        return
      }
      setAssignId(null)
      showSuccess(`${topic.stock_name} 이슈를 배정하고 기획 카드를 만들었습니다.`)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const setStatus = async (topic: TopicItem, status: TopicStatus) => {
    if (guardSample()) return
    setBusyId(topic.id)
    try {
      const { ok, data } = await authedPatchJson<{ ok?: boolean; error?: string }>('/api/v2/topics', { id: topic.id, status })
      if (!ok) {
        showError(data?.error || '상태 변경 실패')
        return
      }
      showSuccess(`${topic.stock_name} → ${TOPIC_STATUS_LABELS[status]}`)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (topic: TopicItem) => {
    if (guardSample()) return
    if (!window.confirm(`${topic.stock_name} 이슈를 삭제할까요?`)) return
    setBusyId(topic.id)
    try {
      const { ok, data } = await authedDeleteJson<{ ok?: boolean; error?: string }>(`/api/v2/topics?id=${topic.id}`)
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
  const counts = TOPIC_STATUSES.reduce<Record<string, number>>((acc, status) => {
    acc[status] = payload.items.filter((item) => item.status === status).length
    return acc
  }, {})

  return (
    <>
      <PageHeader
        title="종목·이슈 큐"
        subtitle="오늘 다룰 종목과 시장 이슈를 쌓아두는 백로그입니다. 관리자가 담당자에게 배정하면 제작 보드의 기획 단계에 카드가 생깁니다."
      />
      <Toast toast={toast} />
      <SampleBanner show={payload.sample} />

      <div className="panel soft">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <div className="v2-section-title" style={{ margin: 0 }}>
            최근 7일 다룬 종목 (등록 영상 기준) — 중복 주의
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
            <div className="panel-title">이슈 등록</div>
            <p className="panel-subtitle">누구나 등록할 수 있습니다. 출처 URL을 남기면 담당자가 팩트 체크하기 쉽습니다.</p>
          </div>
        </div>
        <div className="v2-form-grid">
          <div className="field">
            <label className="label">종목명 *</label>
            <input className="input compact" value={form.stockName} placeholder="예: SK하이닉스" onChange={(e) => setForm({ ...form, stockName: e.target.value })} />
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label className="label">이슈 요약</label>
            <input className="input compact" value={form.issueSummary} placeholder="예: 엔비디아 실적 발표 후 시간외 급등" onChange={(e) => setForm({ ...form, issueSummary: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">출처 URL</label>
            <input className="input compact" value={form.sourceUrl} placeholder="https://" onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">긴급도</label>
            <select className="select compact" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value as Priority })}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <button className="button" disabled={saving} onClick={create}>
              {saving ? '등록 중...' : '큐에 등록'}
            </button>
          </div>
        </div>
        {recentHit ? (
          <div className="small" style={{ marginTop: 10, color: '#fbbf24' }}>
            ⚠ {recentHit.stock_name}은(는) 최근 7일 동안 {recentHit.count}회 다뤘습니다 (마지막 {formatKstDateTime(recentHit.last_at)}). 다른 각도의 이슈인지 확인해 주세요.
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">큐</div>
            <p className="panel-subtitle">대기 → 배정됨 → 제작됨. 배정된 카드가 완료되면 자동으로 제작됨으로 바뀝니다.</p>
          </div>
          <div className="v2-seg">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
              전체 {payload.items.length}
            </button>
            {TOPIC_STATUSES.map((status) => (
              <button key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>
                {TOPIC_STATUS_LABELS[status]} {counts[status]}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="empty-state">{loaded ? '표시할 이슈가 없습니다.' : ''}</div>
        ) : (
          <div className="list">
            {items.map((topic) => {
              const busy = busyId === topic.id
              const canEdit = me.isAdmin || topic.created_by === me.crmUserId
              return (
                <div className="list-item" key={topic.id}>
                  <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="v2-card-title">
                        <span>{topic.stock_name}</span>
                        <PriorityTag priority={topic.urgency} />
                        <TopicStatusTag status={topic.status} />
                      </div>
                      {topic.issue_summary ? (
                        <div className="v2-card-issue" style={{ marginTop: 4 }}>
                          {topic.issue_summary}
                        </div>
                      ) : null}
                      <div className="v2-card-meta" style={{ marginTop: 6 }}>
                        <span>등록 {topic.created_by_name || '-'}</span>
                        <span>{formatKstDateTime(topic.created_at)}</span>
                        {topic.assigned_name ? <span>담당 {topic.assigned_name}</span> : null}
                        {topic.source_url ? (
                          <a className="link" href={topic.source_url} target="_blank" rel="noreferrer">
                            출처 ↗
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <div className="v2-card-actions" style={{ justifyContent: 'flex-end' }}>
                      {me.isAdmin && topic.status === 'waiting' ? (
                        <button className="button xs" disabled={busy} onClick={() => (assignId === topic.id ? setAssignId(null) : openAssign(topic))}>
                          {assignId === topic.id ? '닫기' : '배정'}
                        </button>
                      ) : null}
                      {me.isAdmin && topic.status === 'assigned' ? (
                        <button className="button secondary xs" disabled={busy} onClick={() => void setStatus(topic, 'waiting')}>
                          대기로
                        </button>
                      ) : null}
                      {me.isAdmin && topic.status !== 'produced' ? (
                        <button className="button secondary xs" disabled={busy} onClick={() => void setStatus(topic, 'produced')}>
                          제작됨
                        </button>
                      ) : null}
                      {canEdit ? (
                        <button className="button secondary xs" disabled={busy} style={{ color: '#f87171' }} onClick={() => void remove(topic)}>
                          삭제
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {assignId === topic.id ? (
                    <div className="v2-card-form" style={{ marginTop: 10 }}>
                      <div className="v2-form-grid">
                        <div className="field">
                          <label className="label">담당자</label>
                          <select className="select compact" value={assignDraft.assigneeUserId} onChange={(e) => setAssignDraft({ ...assignDraft, assigneeUserId: e.target.value })}>
                            <option value="">선택</option>
                            {payload.staff.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label className="label">형식</label>
                          <select className="select compact" value={assignDraft.contentType} onChange={(e) => setAssignDraft({ ...assignDraft, contentType: e.target.value as ContentType })}>
                            {CONTENT_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {CONTENT_TYPE_LABELS[type]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label className="label">마감</label>
                          <input className="input compact" type="datetime-local" value={assignDraft.dueAt} onChange={(e) => setAssignDraft({ ...assignDraft, dueAt: e.target.value })} />
                        </div>
                        <div className="field">
                          <label className="label">우선순위</label>
                          <select className="select compact" value={assignDraft.priority} onChange={(e) => setAssignDraft({ ...assignDraft, priority: e.target.value as Priority })}>
                            {PRIORITIES.map((p) => (
                              <option key={p} value={p}>
                                {PRIORITY_LABELS[p]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <button className="button success" disabled={busy} onClick={() => void assign(topic)}>
                            {busy ? '배정 중...' : '배정 → 기획 카드 생성'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
