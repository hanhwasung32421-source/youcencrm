'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/v3/app-shell'
import { Toast, useToast } from '@/components/toast'
import { Callout, DocRow, DocTable, KpiCard, SampleBanner, Section, Tag, type DocColumn } from '@/components/v3/ui'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_TONES, INVOICE_STATUSES, type InvoiceStatus, type SponsorshipInvoice } from '@/lib/v3/finance'
import { formatDate, formatKrw, formatNumber } from '@/lib/v3/format'

type Response = {
  sample: boolean
  invoices: SponsorshipInvoice[]
  summary: { receivable: number; paidThisMonth: number; overdueCount: number }
  staff: { id: string; name: string }[]
  error?: string
}

type FormState = {
  advertiser_name: string
  campaign_name: string
  contract_amount: string
  staff_user_id: string
  video_url: string
  status: InvoiceStatus
  issued_at: string
  due_at: string
  paid_at: string
  memo: string
}

const COLUMNS: DocColumn[] = [
  { key: 'deal', label: '광고주 / 캠페인', width: 'minmax(0, 1.6fr)' },
  { key: 'amount', label: '계약금액', width: '120px', align: 'right' },
  { key: 'staff', label: '담당', width: '80px' },
  { key: 'status', label: '상태', width: '84px' },
  { key: 'issued', label: '발행일', width: '96px' },
  { key: 'due', label: '입금예정', width: '96px' },
  { key: 'paid', label: '입금일', width: '96px' },
  { key: 'actions', label: '', width: '230px' }
]

const EMPTY_FORM: FormState = {
  advertiser_name: '',
  campaign_name: '',
  contract_amount: '',
  staff_user_id: '',
  video_url: '',
  status: 'draft',
  issued_at: '',
  due_at: '',
  paid_at: '',
  memo: ''
}

function toPayload(form: FormState) {
  return {
    advertiser_name: form.advertiser_name.trim(),
    campaign_name: form.campaign_name.trim(),
    contract_amount: Number(String(form.contract_amount).replace(/[^\d]/g, '') || 0),
    staff_user_id: form.staff_user_id || null,
    video_url: form.video_url.trim() || null,
    status: form.status,
    issued_at: form.issued_at || null,
    due_at: form.due_at || null,
    paid_at: form.paid_at || null,
    memo: form.memo.trim() || null
  }
}

// 상태 전이: draft → issued → paid, issued ↔ overdue, 어디서든 draft로 되돌리기 가능
const NEXT_ACTIONS: Record<InvoiceStatus, { to: InvoiceStatus; label: string; cls: string }[]> = {
  draft: [{ to: 'issued', label: '발행', cls: '' }],
  issued: [
    { to: 'paid', label: '입금완료', cls: 'success' },
    { to: 'overdue', label: '연체 처리', cls: 'warning' }
  ],
  overdue: [
    { to: 'paid', label: '입금완료', cls: 'success' },
    { to: 'issued', label: '발행 상태로', cls: 'secondary' }
  ],
  paid: [{ to: 'issued', label: '입금 취소', cls: 'secondary' }]
}

export default function SponsorshipInvoicesPage() {
  const { toast, showSuccess, showError } = useToast()
  const [data, setData] = useState<Response | null>(null)
  const [filter, setFilter] = useState<InvoiceStatus | ''>('')
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState | null>(null)

  const load = useCallback(async () => {
    const { ok, data } = await authedFetchJson<Response>(`/api/v3/sponsorship-invoices${filter ? `?status=${filter}` : ''}`)
    if (!ok || data?.error) {
      showError(data?.error || '인보이스 조회에 실패했습니다.')
      return
    }
    setData(data)
  }, [filter, showError])

  useEffect(() => {
    void load()
  }, [load])

  const invoices = data?.invoices || []

  const submitNew = async () => {
    const payload = toPayload(form)
    if (!payload.advertiser_name || !payload.campaign_name) {
      showError('광고주명과 캠페인명을 입력해 주세요.')
      return
    }
    setSaving(true)
    const { ok, data: res } = await authedPostJson<{ error?: string }>('/api/v3/sponsorship-invoices', payload)
    setSaving(false)
    if (!ok || res?.error) {
      showError(res?.error || '저장에 실패했습니다.')
      return
    }
    showSuccess('인보이스를 등록했습니다.')
    setForm(EMPTY_FORM)
    setAdding(false)
    await load()
  }

  const patch = async (body: Record<string, unknown>, successText: string) => {
    setSaving(true)
    const { ok, data: res } = await authedFetchJson<{ error?: string }>('/api/v3/sponsorship-invoices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    setSaving(false)
    if (!ok || res?.error) {
      showError(res?.error || '처리에 실패했습니다.')
      return false
    }
    showSuccess(successText)
    await load()
    return true
  }

  const changeStatus = (row: SponsorshipInvoice, to: InvoiceStatus) =>
    patch({ id: row.id, status: to }, `${row.advertiser_name} 인보이스를 '${INVOICE_STATUS_LABELS[to]}' 상태로 바꿨습니다.`)

  const startEdit = (row: SponsorshipInvoice) => {
    setEditingId(row.id)
    setEditForm({
      advertiser_name: row.advertiser_name,
      campaign_name: row.campaign_name,
      contract_amount: String(row.contract_amount),
      staff_user_id: row.staff_user_id || '',
      video_url: row.video_url || '',
      status: row.status,
      issued_at: row.issued_at || '',
      due_at: row.due_at || '',
      paid_at: row.paid_at || '',
      memo: row.memo || ''
    })
  }

  const submitEdit = async () => {
    if (!editingId || !editForm) return
    const done = await patch({ id: editingId, ...toPayload(editForm) }, '수정했습니다.')
    if (done) {
      setEditingId(null)
      setEditForm(null)
    }
  }

  const remove = async (row: SponsorshipInvoice) => {
    if (!window.confirm(`${row.advertiser_name} · ${row.campaign_name} 인보이스를 삭제할까요?`)) return
    setSaving(true)
    const { ok, data: res } = await authedFetchJson<{ error?: string }>(`/api/v3/sponsorship-invoices?id=${row.id}`, { method: 'DELETE' })
    setSaving(false)
    if (!ok || res?.error) {
      showError(res?.error || '삭제에 실패했습니다.')
      return
    }
    showSuccess('삭제했습니다.')
    await load()
  }

  const renderFormFields = (state: FormState, setState: (next: FormState) => void) => (
    <div className="v3-form-grid">
      <div className="field">
        <label className="label">광고주명</label>
        <input className="input" value={state.advertiser_name} placeholder="키움증권" onChange={(e) => setState({ ...state, advertiser_name: e.target.value })} />
      </div>
      <div className="field" style={{ gridColumn: 'span 2' }}>
        <label className="label">캠페인명</label>
        <input className="input" value={state.campaign_name} placeholder="신규 계좌 개설 프로모션" onChange={(e) => setState({ ...state, campaign_name: e.target.value })} />
      </div>
      <div className="field">
        <label className="label">계약금액 (원)</label>
        <input
          className="input"
          inputMode="numeric"
          value={state.contract_amount ? Number(String(state.contract_amount).replace(/[^\d]/g, '') || 0).toLocaleString('ko-KR') : ''}
          onChange={(e) => setState({ ...state, contract_amount: e.target.value.replace(/[^\d]/g, '') })}
        />
      </div>
      <div className="field">
        <label className="label">담당 직원</label>
        <select className="select" value={state.staff_user_id} onChange={(e) => setState({ ...state, staff_user_id: e.target.value })}>
          <option value="">미지정</option>
          {(data?.staff || []).map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="label">상태</label>
        <select className="select" value={state.status} onChange={(e) => setState({ ...state, status: e.target.value as InvoiceStatus })}>
          {INVOICE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {INVOICE_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="field" style={{ gridColumn: 'span 2' }}>
        <label className="label">영상 URL</label>
        <input className="input" value={state.video_url} placeholder="https://www.youtube.com/watch?v=" onChange={(e) => setState({ ...state, video_url: e.target.value })} />
      </div>
      <div className="field">
        <label className="label">발행일</label>
        <input className="input" type="date" value={state.issued_at} onChange={(e) => setState({ ...state, issued_at: e.target.value })} />
      </div>
      <div className="field">
        <label className="label">입금예정일</label>
        <input className="input" type="date" value={state.due_at} onChange={(e) => setState({ ...state, due_at: e.target.value })} />
      </div>
      <div className="field">
        <label className="label">입금일</label>
        <input className="input" type="date" value={state.paid_at} onChange={(e) => setState({ ...state, paid_at: e.target.value })} />
      </div>
      <div className="field" style={{ gridColumn: '1 / -1' }}>
        <label className="label">메모</label>
        <input className="input" value={state.memo} placeholder="계약 조건, 노출 방식 등" onChange={(e) => setState({ ...state, memo: e.target.value })} />
      </div>
    </div>
  )

  return (
    <>
      <PageHeader icon="🤝" title="협찬 · 광고 정산" subtitle="광고주 계약을 인보이스 단위로 관리하고, 발행 → 입금 → 연체 흐름을 추적합니다." />
      <Toast toast={toast} />
      <SampleBanner show={!!data?.sample} />

      {data ? (
        <div className="v3-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <KpiCard label="미수금 총액 (발행 + 연체)" current={data.summary.receivable} />
          <KpiCard label="이번 달 입금" current={data.summary.paidThisMonth} />
          <KpiCard label="연체 건수" current={data.summary.overdueCount} format={(v) => `${formatNumber(v)}건`} />
        </div>
      ) : null}

      {data && data.summary.overdueCount > 0 ? (
        <Callout icon="⚠️" tone="warning">
          <strong>연체 {data.summary.overdueCount}건.</strong> 입금예정일이 지났거나 연체 처리된 인보이스가 있습니다. 광고주에게 입금 확인 요청을 보내세요.
        </Callout>
      ) : null}

      <Section
        title="인보이스"
        count={invoices.length}
        description="상태 버튼을 누르면 발행일 · 입금일이 자동으로 채워집니다."
        actions={
          <>
            <div className="row" style={{ gap: 4 }}>
              <button className={`button secondary xs ${filter === '' ? 'active' : ''}`} onClick={() => setFilter('')}>
                전체
              </button>
              {INVOICE_STATUSES.map((status) => (
                <button key={status} className={`button secondary xs ${filter === status ? 'active' : ''}`} onClick={() => setFilter(status)}>
                  {INVOICE_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
            <button className="button xs" onClick={() => setAdding((v) => !v)} disabled={saving}>
              {adding ? '입력 닫기' : '+ 인보이스 등록'}
            </button>
          </>
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
                {saving ? '저장 중…' : '등록'}
              </button>
            </div>
          </div>
        ) : null}

        <DocTable columns={COLUMNS} isEmpty={invoices.length === 0} empty="조건에 맞는 인보이스가 없습니다.">
          {invoices.map((row) =>
            editingId === row.id && editForm ? (
              <div className="data-table-row v3-row-editing" key={row.id} style={{ gridTemplateColumns: '1fr', display: 'grid' }}>
                {renderFormFields(editForm, setEditForm)}
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
                <div style={{ minWidth: 0 }}>
                  <div className="v3-cell-main">{row.advertiser_name}</div>
                  <div className="v3-cell-sub">
                    {row.campaign_name}
                    {row.video_url ? (
                      <>
                        {' · '}
                        <a className="v3-link" href={row.video_url} target="_blank" rel="noreferrer">
                          영상
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="data-right" style={{ fontWeight: 600 }}>
                  {formatKrw(row.contract_amount)}
                </div>
                <div className="small">{row.staff_name || '—'}</div>
                <div>
                  <Tag tone={INVOICE_STATUS_TONES[row.status]}>{INVOICE_STATUS_LABELS[row.status]}</Tag>
                </div>
                <div className="small muted">{formatDate(row.issued_at)}</div>
                <div className="small muted">{formatDate(row.due_at)}</div>
                <div className="small muted">{formatDate(row.paid_at)}</div>
                <div className="v3-cell-actions">
                  {NEXT_ACTIONS[row.status].map((action) => (
                    <button key={action.to} className={`button xs ${action.cls}`} onClick={() => changeStatus(row, action.to)} disabled={saving}>
                      {action.label}
                    </button>
                  ))}
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
        </DocTable>
      </Section>
    </>
  )
}
