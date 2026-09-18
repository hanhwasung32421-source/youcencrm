'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/v4/app-shell'
import { useV4Me } from '@/components/v4/me-context'
import { EmptyState, SampleBanner } from '@/components/v4/ui'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { getKstYmd } from '@/lib/attendance/time'
import type { ExperimentItem } from '@/lib/v4/sample-data'
import type { VideoOption } from '@/lib/v4/experiments'
import { fmtDateKst } from '@/lib/v4/format'

type ExperimentsResponse = {
  sample: boolean
  scope: 'admin' | 'staff'
  items: ExperimentItem[]
  videoOptions: VideoOption[]
  error?: string
}

type Winner = 'a' | 'b' | 'tie' | ''

type FormState = {
  videoId: string
  hypothesis: string
  variantA: string
  variantB: string
  metric: string
  startedOn: string
  endedOn: string
  winner: Winner
  learning: string
}

const emptyForm = (): FormState => ({
  videoId: '',
  hypothesis: '',
  variantA: '',
  variantB: '',
  metric: '',
  startedOn: getKstYmd(),
  endedOn: '',
  winner: '',
  learning: ''
})

const WINNER_LABEL: Record<'a' | 'b' | 'tie', string> = { a: 'A 승', b: 'B 승', tie: '무승부' }

export default function ExperimentsPage() {
  const { me, isAdmin } = useV4Me()
  const { toast, showSuccess, showError } = useToast()
  const [data, setData] = useState<ExperimentsResponse | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'running' | 'done'>('all')

  const load = async () => {
    const { ok, data: res } = await authedFetchJson<ExperimentsResponse>('/api/v4/experiments')
    if (!ok || res?.error) {
      showError(res?.error || '실험 목록 조회에 실패했습니다.')
      return
    }
    setData(res)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }))

  const startEdit = (item: ExperimentItem) => {
    setEditingId(item.id)
    setForm({
      videoId: item.videoId || '',
      hypothesis: item.hypothesis,
      variantA: item.variantA,
      variantB: item.variantB,
      metric: item.metric,
      startedOn: item.startedOn,
      endedOn: item.endedOn || '',
      winner: item.winner || '',
      learning: item.learning || ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(emptyForm())
  }

  const submit = async () => {
    if (!form.hypothesis.trim() || !form.variantA.trim() || !form.variantB.trim() || !form.metric.trim()) {
      showError('가설, 변형 A/B, 지표는 필수입니다.')
      return
    }
    setSaving(true)
    const payload = {
      videoId: form.videoId || null,
      hypothesis: form.hypothesis.trim(),
      variantA: form.variantA.trim(),
      variantB: form.variantB.trim(),
      metric: form.metric.trim(),
      startedOn: form.startedOn,
      endedOn: form.endedOn || null,
      winner: form.winner || null,
      learning: form.learning.trim() || null
    }
    const result = editingId
      ? await authedFetchJson<{ error?: string }>(`/api/v4/experiments/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      : await authedPostJson<{ error?: string }>('/api/v4/experiments', payload)
    setSaving(false)
    if (!result.ok || result.data?.error) {
      showError(result.data?.error || '저장에 실패했습니다.')
      return
    }
    showSuccess(editingId ? '실험을 수정했습니다.' : '실험을 등록했습니다.')
    cancelEdit()
    void load()
  }

  const remove = async (item: ExperimentItem) => {
    if (!window.confirm('이 실험 기록을 삭제할까요?')) return
    setDeletingId(item.id)
    const { ok, data: res } = await authedFetchJson<{ error?: string }>(`/api/v4/experiments/${item.id}`, { method: 'DELETE' })
    setDeletingId(null)
    if (!ok || res?.error) {
      showError(res?.error || '삭제에 실패했습니다.')
      return
    }
    showSuccess('실험을 삭제했습니다.')
    if (editingId === item.id) cancelEdit()
    void load()
  }

  const items = useMemo(() => {
    const list = data?.items || []
    if (filter === 'running') return list.filter((i) => !i.winner)
    if (filter === 'done') return list.filter((i) => Boolean(i.winner))
    return list
  }, [data, filter])

  const learnings = useMemo(() => (data?.items || []).filter((i) => i.learning && i.learning.trim()), [data])
  const runningCount = (data?.items || []).filter((i) => !i.winner).length
  const canEdit = (item: ExperimentItem) => isAdmin || (me?.crmUserId && item.createdBy === me.crmUserId)

  return (
    <>
      <PageHeader
        title="실험 관리 (A/B 로그)"
        subtitle={data ? `실험 ${data.items.length}건 · 진행 중 ${runningCount}건 · 학습 노트 ${learnings.length}건` : '썸네일·제목 실험을 기록하고 결론을 남깁니다.'}
      />
      <Toast toast={toast} />
      <SampleBanner show={Boolean(data?.sample)} />

      <div className="grid grid-3">
        <div className="panel" style={{ gridColumn: 'span 2' }}>
          <div className="panel-header">
            <div>
              <div className="panel-title">{editingId ? '실험 수정 / 결과 기록' : '새 실험 등록'}</div>
              <p className="panel-subtitle">한 번에 한 가지 변수만 바꿔야 결과를 해석할 수 있습니다.</p>
            </div>
            {editingId ? (
              <button className="button secondary" onClick={cancelEdit} disabled={saving}>
                취소
              </button>
            ) : null}
          </div>
          <div className="form-stack">
            <div className="field">
              <label className="label">대상 영상</label>
              <select className="select" value={form.videoId} onChange={(e) => update({ videoId: e.target.value })}>
                <option value="">영상 미연결 (채널 전체 실험 등)</option>
                {(data?.videoOptions || []).map((v) => (
                  <option key={v.id} value={v.id}>
                    [{v.stockName}] {v.title} · {fmtDateKst(v.createdAt)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">가설</label>
              <textarea className="textarea" style={{ minHeight: 70 }} value={form.hypothesis} onChange={(e) => update({ hypothesis: e.target.value })} placeholder="예: 종목명을 썸네일에 크게 넣으면 CTR이 오른다" />
            </div>
            <div className="v4-exp-variants" style={{ marginTop: 0 }}>
              <div className="field">
                <label className="label">변형 A (기존)</label>
                <textarea className="textarea" style={{ minHeight: 60 }} value={form.variantA} onChange={(e) => update({ variantA: e.target.value })} />
              </div>
              <div className="field">
                <label className="label">변형 B (실험)</label>
                <textarea className="textarea" style={{ minHeight: 60 }} value={form.variantB} onChange={(e) => update({ variantB: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-3">
              <div className="field">
                <label className="label">지표 (조회수 / CTR 메모)</label>
                <input className="input" value={form.metric} onChange={(e) => update({ metric: e.target.value })} placeholder="예: 48시간 조회수" />
              </div>
              <div className="field">
                <label className="label">시작일</label>
                <input className="input" type="date" value={form.startedOn} onChange={(e) => update({ startedOn: e.target.value })} />
              </div>
              <div className="field">
                <label className="label">종료일</label>
                <input className="input" type="date" value={form.endedOn} onChange={(e) => update({ endedOn: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-3">
              <div className="field">
                <label className="label">결과 (승자)</label>
                <select className="select" value={form.winner} onChange={(e) => update({ winner: e.target.value as Winner })}>
                  <option value="">진행 중 (미정)</option>
                  <option value="a">A 승</option>
                  <option value="b">B 승</option>
                  <option value="tie">무승부</option>
                </select>
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label className="label">학습 메모</label>
                <textarea className="textarea" style={{ minHeight: 60 }} value={form.learning} onChange={(e) => update({ learning: e.target.value })} placeholder="결론과 다음에 적용할 점" />
              </div>
            </div>
            <div className="row">
              <button className="button" onClick={submit} disabled={saving}>
                {saving ? '저장 중...' : editingId ? '수정 저장' : '실험 등록'}
              </button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">학습 노트</div>
              <p className="panel-subtitle">결론이 기록된 실험만 모았습니다.</p>
            </div>
          </div>
          {learnings.length === 0 ? (
            <EmptyState>아직 기록된 학습이 없습니다.</EmptyState>
          ) : (
            <div className="list">
              {learnings.map((item) => (
                <div className="list-item" key={item.id}>
                  <div className="row-between">
                    <span className={`v4-winner ${item.winner || 'running'}`}>{item.winner ? WINNER_LABEL[item.winner] : '진행 중'}</span>
                    <span className="small muted">{fmtDateKst(item.endedOn || item.startedOn)}</span>
                  </div>
                  <div className="small" style={{ marginTop: 8, fontWeight: 700 }}>{item.hypothesis}</div>
                  <div className="small muted" style={{ marginTop: 6, lineHeight: 1.6 }}>{item.learning}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">실험 목록</div>
            <p className="panel-subtitle">{isAdmin ? '팀 전체 실험' : '내가 등록한 실험'}</p>
          </div>
          <div className="v4-segment" role="group" aria-label="상태 필터">
            {(
              [
                ['all', '전체'],
                ['running', '진행 중'],
                ['done', '완료']
              ] as Array<[typeof filter, string]>
            ).map(([value, label]) => (
              <button key={value} type="button" className={`v4-segment-item ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {items.length === 0 ? (
          <EmptyState>표시할 실험이 없습니다.</EmptyState>
        ) : (
          <div className="list">
            {items.map((item) => (
              <div className="list-item" key={item.id}>
                <div className="v4-exp">
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                      <span className={`v4-winner ${item.winner || 'running'}`}>{item.winner ? WINNER_LABEL[item.winner] : '진행 중'}</span>
                      <span className="small muted">
                        {fmtDateKst(item.startedOn)} ~ {item.endedOn ? fmtDateKst(item.endedOn) : '진행 중'}
                      </span>
                      <span className="small muted">· {item.createdByName}</span>
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>{item.hypothesis}</div>
                    <div className="small muted" style={{ marginTop: 4 }}>
                      영상: {item.videoTitle} {item.stockName !== '-' ? `(${item.stockName})` : ''} · 지표: {item.metric}
                    </div>
                    <div className="v4-exp-variants">
                      <div className={`v4-variant ${item.winner === 'a' ? 'win' : ''}`}>
                        <div className="v4-variant-tag">변형 A</div>
                        {item.variantA}
                      </div>
                      <div className={`v4-variant ${item.winner === 'b' ? 'win' : ''}`}>
                        <div className="v4-variant-tag">변형 B</div>
                        {item.variantB}
                      </div>
                    </div>
                    {item.learning ? <div className="v4-learning">{item.learning}</div> : null}
                  </div>
                  {canEdit(item) && !data?.sample ? (
                    <div className="stack" style={{ gap: 8 }}>
                      <button className="button secondary" onClick={() => startEdit(item)} disabled={saving}>
                        {item.winner ? '수정' : '결과 기록'}
                      </button>
                      <button className="button danger" onClick={() => remove(item)} disabled={deletingId === item.id}>
                        {deletingId === item.id ? '삭제 중...' : '삭제'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
