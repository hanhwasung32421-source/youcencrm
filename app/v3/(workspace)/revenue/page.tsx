'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/v3/app-shell'
import { Toast, useToast } from '@/components/toast'
import { Callout, DocRow, DocTable, MonthPicker, SampleBanner, Section, Tag, type DocColumn } from '@/components/v3/ui'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import {
  formatMonthLabel,
  getCurrentMonth,
  STREAM_LABELS,
  STREAM_TYPES,
  sumStreams,
  type RevenueEntry,
  type StreamType
} from '@/lib/v3/finance'
import { formatKrw } from '@/lib/v3/format'

type Response = {
  sample: boolean
  months: string[]
  entries: RevenueEntry[]
  channels: { id: string; name: string }[]
  error?: string
}

type FormState = {
  month: string
  stream_type: StreamType
  channel_id: string
  amount: string
  memo: string
  evidence_url: string
}

const STREAM_TONES: Record<StreamType, 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'gray'> = {
  adsense: 'blue',
  membership: 'green',
  superchat: 'amber',
  sponsorship: 'red',
  leading_product: 'violet',
  other: 'gray'
}

const COLUMNS: DocColumn[] = [
  { key: 'month', label: '월', width: '88px' },
  { key: 'stream', label: '수익원', width: '110px' },
  { key: 'channel', label: '채널', width: 'minmax(0, 1fr)' },
  { key: 'amount', label: '금액', width: '130px', align: 'right' },
  { key: 'memo', label: '메모', width: 'minmax(0, 1.4fr)' },
  { key: 'evidence', label: '증빙', width: '60px' },
  { key: 'actions', label: '', width: '132px' }
]

function emptyForm(month: string): FormState {
  return { month, stream_type: 'adsense', channel_id: '', amount: '', memo: '', evidence_url: '' }
}

function toPayload(form: FormState) {
  const amount = Number(String(form.amount).replace(/[^\d]/g, ''))
  return {
    month: form.month,
    stream_type: form.stream_type,
    channel_id: form.channel_id || null,
    amount: Number.isFinite(amount) ? amount : 0,
    memo: form.memo.trim() || null,
    evidence_url: form.evidence_url.trim() || null
  }
}

export default function RevenueStreamsPage() {
  const { toast, showSuccess, showError } = useToast()
  const [month, setMonth] = useState(getCurrentMonth())
  const [showAll, setShowAll] = useState(false)
  const [data, setData] = useState<Response | null>(null)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm(getCurrentMonth()))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState | null>(null)

  const load = useCallback(async () => {
    const path = showAll ? '/api/v3/revenue-entries' : `/api/v3/revenue-entries?month=${month}`
    const { ok, data } = await authedFetchJson<Response>(path)
    if (!ok || data?.error) {
      showError(data?.error || '수익원 항목 조회에 실패했습니다.')
      return
    }
    setData(data)
  }, [month, showAll, showError])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setForm((prev) => ({ ...prev, month }))
  }, [month])

  const entries = data?.entries || []
  const byStream = useMemo(() => sumStreams(entries), [entries])
  const total = useMemo(() => entries.reduce((sum, row) => sum + row.amount, 0), [entries])

  const submitNew = async () => {
    const payload = toPayload(form)
    if (payload.amount <= 0) {
      showError('금액을 입력해 주세요.')
      return
    }
    setSaving(true)
    const { ok, data: res } = await authedPostJson<{ error?: string }>('/api/v3/revenue-entries', payload)
    setSaving(false)
    if (!ok || res?.error) {
      showError(res?.error || '저장에 실패했습니다.')
      return
    }
    showSuccess('수익원 항목을 추가했습니다.')
    setForm(emptyForm(month))
    setAdding(false)
    await load()
  }

  const startEdit = (row: RevenueEntry) => {
    setEditingId(row.id)
    setEditForm({
      month: row.month,
      stream_type: row.stream_type,
      channel_id: row.channel_id || '',
      amount: String(row.amount),
      memo: row.memo || '',
      evidence_url: row.evidence_url || ''
    })
  }

  const submitEdit = async () => {
    if (!editingId || !editForm) return
    setSaving(true)
    const { ok, data: res } = await authedFetchJson<{ error?: string }>('/api/v3/revenue-entries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, ...toPayload(editForm) })
    })
    setSaving(false)
    if (!ok || res?.error) {
      showError(res?.error || '수정에 실패했습니다.')
      return
    }
    showSuccess('수정했습니다.')
    setEditingId(null)
    setEditForm(null)
    await load()
  }

  const remove = async (row: RevenueEntry) => {
    if (!window.confirm(`${row.month} ${STREAM_LABELS[row.stream_type]} ${formatKrw(row.amount)} 항목을 삭제할까요?`)) return
    setSaving(true)
    const { ok, data: res } = await authedFetchJson<{ error?: string }>(`/api/v3/revenue-entries?id=${row.id}`, { method: 'DELETE' })
    setSaving(false)
    if (!ok || res?.error) {
      showError(res?.error || '삭제에 실패했습니다.')
      return
    }
    showSuccess('삭제했습니다.')
    await load()
  }

  const renderFormFields = (state: FormState, setState: (next: FormState) => void, compact = false) => (
    <div className="v3-form-grid">
      <div className="field">
        <label className="label">월</label>
        <input className="input" type="month" value={state.month} onChange={(e) => setState({ ...state, month: e.target.value })} />
      </div>
      <div className="field">
        <label className="label">수익원 유형</label>
        <select className="select" value={state.stream_type} onChange={(e) => setState({ ...state, stream_type: e.target.value as StreamType })}>
          {STREAM_TYPES.map((stream) => (
            <option key={stream} value={stream}>
              {STREAM_LABELS[stream]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="label">채널</label>
        <select className="select" value={state.channel_id} onChange={(e) => setState({ ...state, channel_id: e.target.value })}>
          <option value="">전체 / 미지정</option>
          {(data?.channels || []).map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="label">금액 (원)</label>
        <input
          className="input"
          inputMode="numeric"
          placeholder="5,200,000"
          value={state.amount ? Number(String(state.amount).replace(/[^\d]/g, '') || 0).toLocaleString('ko-KR') : ''}
          onChange={(e) => setState({ ...state, amount: e.target.value.replace(/[^\d]/g, '') })}
        />
      </div>
      <div className="field" style={{ gridColumn: compact ? undefined : 'span 2' }}>
        <label className="label">메모</label>
        <input className="input" value={state.memo} placeholder="예: 애드센스 8월 정산" onChange={(e) => setState({ ...state, memo: e.target.value })} />
      </div>
      <div className="field" style={{ gridColumn: compact ? undefined : 'span 2' }}>
        <label className="label">증빙 URL</label>
        <input className="input" value={state.evidence_url} placeholder="https://" onChange={(e) => setState({ ...state, evidence_url: e.target.value })} />
      </div>
    </div>
  )

  return (
    <>
      <PageHeader
        icon="💵"
        title="수익원 관리"
        subtitle="애드센스 · 멤버십 · 슈퍼챗 · 협찬 · 리딩 상품 매출을 월 단위 원장으로 기록합니다."
        actions={
          <div className="row">
            <button className={`button secondary xs ${showAll ? 'active' : ''}`} onClick={() => setShowAll((v) => !v)}>
              {showAll ? '최근 12개월 보는 중' : '최근 12개월 보기'}
            </button>
            <MonthPicker value={month} onChange={setMonth} disabled={showAll} />
          </div>
        }
      />
      <Toast toast={toast} />
      <SampleBanner show={!!data?.sample} />

      <Callout icon="Σ">
        <strong>{showAll ? '최근 12개월' : formatMonthLabel(month)} 합계 {formatKrw(total)}.</strong>{' '}
        {STREAM_TYPES.filter((stream) => byStream[stream] > 0)
          .map((stream) => `${STREAM_LABELS[stream]} ${formatKrw(byStream[stream])}`)
          .join(' · ') || '등록된 항목이 없습니다.'}
      </Callout>

      <Section
        title="수익원 항목"
        count={entries.length}
        description="행에 마우스를 올리면 편집 · 삭제 버튼이 보입니다."
        actions={
          <button className="button xs" onClick={() => setAdding((v) => !v)} disabled={saving}>
            {adding ? '입력 닫기' : '+ 항목 추가'}
          </button>
        }
      >
        {adding ? (
          <div className="v3-inline-form">
            {renderFormFields(form, setForm)}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="button secondary xs" onClick={() => setAdding(false)} disabled={saving}>
                취소
              </button>
              <button className="button xs" onClick={submitNew} disabled={saving}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        ) : null}

        <DocTable columns={COLUMNS} isEmpty={entries.length === 0} empty="이 달에 기록된 수익원 항목이 없습니다. 항목 추가로 첫 매출을 기록해 보세요.">
          {entries.map((row) =>
            editingId === row.id && editForm ? (
              <div className="data-table-row v3-row-editing" key={row.id} style={{ gridTemplateColumns: '1fr', display: 'grid' }}>
                {renderFormFields(editForm, setEditForm, true)}
                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    className="button secondary xs"
                    onClick={() => {
                      setEditingId(null)
                      setEditForm(null)
                    }}
                    disabled={saving}
                  >
                    취소
                  </button>
                  <button className="button xs" onClick={submitEdit} disabled={saving}>
                    {saving ? '저장 중…' : '수정 저장'}
                  </button>
                </div>
              </div>
            ) : (
              <DocRow columns={COLUMNS} key={row.id}>
                <div className="muted small">{row.month}</div>
                <div>
                  <Tag tone={STREAM_TONES[row.stream_type]}>{STREAM_LABELS[row.stream_type]}</Tag>
                </div>
                <div className="v3-cell-sub" style={{ color: 'inherit' }}>
                  {row.channel_name || '전체'}
                </div>
                <div className="data-right" style={{ fontWeight: 600 }}>
                  {formatKrw(row.amount)}
                </div>
                <div className="v3-cell-sub">{row.memo || '—'}</div>
                <div>
                  {row.evidence_url ? (
                    <a className="v3-link small" href={row.evidence_url} target="_blank" rel="noreferrer">
                      링크
                    </a>
                  ) : (
                    <span className="muted small">—</span>
                  )}
                </div>
                <div className="v3-cell-actions">
                  <button className="button secondary xs" onClick={() => startEdit(row)} disabled={saving}>
                    편집
                  </button>
                  <button className="button danger xs" onClick={() => remove(row)} disabled={saving}>
                    삭제
                  </button>
                </div>
              </DocRow>
            )
          )}
          {entries.length > 0 ? (
            <DocRow columns={COLUMNS} className="v3-row-total">
              <div>합계</div>
              <div />
              <div />
              <div className="data-right">{formatKrw(total)}</div>
              <div />
              <div />
              <div />
            </DocRow>
          ) : null}
        </DocTable>
      </Section>
    </>
  )
}
