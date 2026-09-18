'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/v3/app-shell'
import { Toast, useToast } from '@/components/toast'
import { Callout, DocRow, DocTable, KpiCard, MonthPicker, SampleBanner, Section, Tag, type DocColumn } from '@/components/v3/ui'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import {
  EXPENSE_LABELS,
  EXPENSE_TYPES,
  formatMonthLabel,
  formatMonthShort,
  getCurrentMonth,
  STREAM_LABELS,
  STREAM_TYPES,
  type ExpenseEntry,
  type ExpenseType,
  type PnlStatement
} from '@/lib/v3/finance'
import { formatKrw, formatKrwCompact, formatPct } from '@/lib/v3/format'

type ExpenseResponse = { sample: boolean; months: string[]; entries: ExpenseEntry[]; error?: string }
type PnlResponse = {
  sample: boolean
  month: string
  statement: PnlStatement
  previous: PnlStatement
  trend: { month: string; revenue: number; expense: number; incentive: number; net: number }[]
  error?: string
}

type FormState = { month: string; expense_type: ExpenseType; amount: string; memo: string }

const EXPENSE_TONES: Record<ExpenseType, 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'gray'> = {
  labor: 'blue',
  equipment: 'amber',
  software: 'violet',
  marketing: 'green',
  other: 'gray'
}

const COLUMNS: DocColumn[] = [
  { key: 'month', label: '월', width: '88px' },
  { key: 'type', label: '항목', width: '110px' },
  { key: 'amount', label: '금액', width: '130px', align: 'right' },
  { key: 'memo', label: '메모', width: 'minmax(0, 1fr)' },
  { key: 'actions', label: '', width: '132px' }
]

export default function ExpensesAndPnlPage() {
  const { toast, showSuccess, showError } = useToast()
  const [month, setMonth] = useState(getCurrentMonth())
  const [expenses, setExpenses] = useState<ExpenseResponse | null>(null)
  const [pnl, setPnl] = useState<PnlResponse | null>(null)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<FormState>({ month: getCurrentMonth(), expense_type: 'labor', amount: '', memo: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState | null>(null)

  const load = useCallback(
    async (target: string) => {
      const [expRes, pnlRes] = await Promise.all([
        authedFetchJson<ExpenseResponse>(`/api/v3/expense-entries?month=${target}`),
        authedFetchJson<PnlResponse>(`/api/v3/pnl?month=${target}`)
      ])
      if (!expRes.ok || expRes.data?.error) showError(expRes.data?.error || '비용 조회에 실패했습니다.')
      else setExpenses(expRes.data)
      if (!pnlRes.ok || pnlRes.data?.error) showError(pnlRes.data?.error || '손익 조회에 실패했습니다.')
      else setPnl(pnlRes.data)
    },
    [showError]
  )

  useEffect(() => {
    void load(month)
    setForm((prev) => ({ ...prev, month }))
  }, [month, load])

  const entries = expenses?.entries || []
  const expenseTotal = useMemo(() => entries.reduce((sum, row) => sum + row.amount, 0), [entries])

  const toPayload = (state: FormState) => ({
    month: state.month,
    expense_type: state.expense_type,
    amount: Number(String(state.amount).replace(/[^\d]/g, '') || 0),
    memo: state.memo.trim() || null
  })

  const submitNew = async () => {
    const payload = toPayload(form)
    if (payload.amount <= 0) {
      showError('금액을 입력해 주세요.')
      return
    }
    setSaving(true)
    const { ok, data } = await authedPostJson<{ error?: string }>('/api/v3/expense-entries', payload)
    setSaving(false)
    if (!ok || data?.error) {
      showError(data?.error || '저장에 실패했습니다.')
      return
    }
    showSuccess('비용 항목을 추가했습니다.')
    setForm({ month, expense_type: 'labor', amount: '', memo: '' })
    setAdding(false)
    await load(month)
  }

  const submitEdit = async () => {
    if (!editingId || !editForm) return
    setSaving(true)
    const { ok, data } = await authedFetchJson<{ error?: string }>('/api/v3/expense-entries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, ...toPayload(editForm) })
    })
    setSaving(false)
    if (!ok || data?.error) {
      showError(data?.error || '수정에 실패했습니다.')
      return
    }
    showSuccess('수정했습니다.')
    setEditingId(null)
    setEditForm(null)
    await load(month)
  }

  const remove = async (row: ExpenseEntry) => {
    if (!window.confirm(`${row.month} ${EXPENSE_LABELS[row.expense_type]} ${formatKrw(row.amount)} 항목을 삭제할까요?`)) return
    setSaving(true)
    const { ok, data } = await authedFetchJson<{ error?: string }>(`/api/v3/expense-entries?id=${row.id}`, { method: 'DELETE' })
    setSaving(false)
    if (!ok || data?.error) {
      showError(data?.error || '삭제에 실패했습니다.')
      return
    }
    showSuccess('삭제했습니다.')
    await load(month)
  }

  const renderFormFields = (state: FormState, setState: (next: FormState) => void) => (
    <div className="v3-form-grid">
      <div className="field">
        <label className="label">월</label>
        <input className="input" type="month" value={state.month} onChange={(e) => setState({ ...state, month: e.target.value })} />
      </div>
      <div className="field">
        <label className="label">항목 유형</label>
        <select className="select" value={state.expense_type} onChange={(e) => setState({ ...state, expense_type: e.target.value as ExpenseType })}>
          {EXPENSE_TYPES.map((type) => (
            <option key={type} value={type}>
              {EXPENSE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="label">금액 (원)</label>
        <input
          className="input"
          inputMode="numeric"
          value={state.amount ? Number(String(state.amount).replace(/[^\d]/g, '') || 0).toLocaleString('ko-KR') : ''}
          onChange={(e) => setState({ ...state, amount: e.target.value.replace(/[^\d]/g, '') })}
        />
      </div>
      <div className="field" style={{ gridColumn: 'span 2' }}>
        <label className="label">메모</label>
        <input className="input" value={state.memo} placeholder="예: 편집자 급여, 조명 장비 구매" onChange={(e) => setState({ ...state, memo: e.target.value })} />
      </div>
    </div>
  )

  const statement = pnl?.statement
  const previous = pnl?.previous
  const trendMax = Math.max(...(pnl?.trend || []).map((t) => Math.max(t.revenue, t.expense + t.incentive, Math.abs(t.net))), 1)

  return (
    <>
      <PageHeader
        icon="📉"
        title="비용 · 손익"
        subtitle="월별 비용을 기록하고, 매출 − 비용 − 인센티브 = 순이익 손익계산서를 확인합니다."
        actions={
          <div className="row v3-no-print">
            <button className="button secondary xs" onClick={() => window.print()}>
              🖨 인쇄
            </button>
            <MonthPicker value={month} onChange={setMonth} disabled={saving} />
          </div>
        }
      />
      <Toast toast={toast} />
      <SampleBanner show={!!expenses?.sample || !!pnl?.sample} />

      {statement && previous ? (
        <>
          <Callout icon="📒" tone={statement.netProfit >= 0 ? 'success' : 'warning'}>
            <strong>
              {formatMonthLabel(month)} 순이익 {formatKrw(statement.netProfit)} (마진 {formatPct(statement.marginPct)}).
            </strong>{' '}
            매출 {formatKrw(statement.revenueTotal)} − 비용 {formatKrw(statement.expenseTotal)} − 인센티브 {formatKrw(statement.incentiveTotal)}. 전월 순이익은{' '}
            {formatKrw(previous.netProfit)}였습니다.
          </Callout>

          <div className="v3-kpi-grid">
            <KpiCard label="매출" current={statement.revenueTotal} previous={previous.revenueTotal} />
            <KpiCard label="비용" current={statement.expenseTotal} previous={previous.expenseTotal} invert />
            <KpiCard label="인센티브" current={statement.incentiveTotal} previous={previous.incentiveTotal} invert />
            <KpiCard label="순이익" current={statement.netProfit} previous={previous.netProfit} />
          </div>
        </>
      ) : null}

      <div className="v3-no-print">
        <Section
          title="비용 항목"
          count={entries.length}
          description={`${formatMonthLabel(month)} 비용 합계 ${formatKrw(expenseTotal)}`}
          actions={
            <button className="button xs" onClick={() => setAdding((v) => !v)} disabled={saving}>
              {adding ? '입력 닫기' : '+ 비용 추가'}
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

          <DocTable columns={COLUMNS} isEmpty={entries.length === 0} empty="이 달에 기록된 비용이 없습니다.">
            {entries.map((row) =>
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
                  <div className="small muted">{row.month}</div>
                  <div>
                    <Tag tone={EXPENSE_TONES[row.expense_type]}>{EXPENSE_LABELS[row.expense_type]}</Tag>
                  </div>
                  <div className="data-right" style={{ fontWeight: 600 }}>
                    {formatKrw(row.amount)}
                  </div>
                  <div className="v3-cell-sub">{row.memo || '—'}</div>
                  <div className="v3-cell-actions">
                    <button
                      className="button secondary xs"
                      onClick={() => {
                        setEditingId(row.id)
                        setEditForm({ month: row.month, expense_type: row.expense_type, amount: String(row.amount), memo: row.memo || '' })
                      }}
                      disabled={saving}
                    >
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
      </div>

      {statement && previous ? (
        <Section title={`${formatMonthLabel(month)} 손익계산서`} description="인쇄 버튼을 누르면 이 표만 깔끔하게 출력됩니다.">
          <table className="v3-print-table">
            <thead>
              <tr>
                <th>항목</th>
                <th className="num">{formatMonthLabel(month)}</th>
                <th className="num">전월</th>
                <th className="num">증감</th>
              </tr>
            </thead>
            <tbody>
              <tr className="section">
                <td>매출</td>
                <td className="num">{formatKrw(statement.revenueTotal)}</td>
                <td className="num">{formatKrw(previous.revenueTotal)}</td>
                <td className="num">{formatKrw(statement.revenueTotal - previous.revenueTotal)}</td>
              </tr>
              {STREAM_TYPES.map((stream) => (
                <tr className="indent" key={stream}>
                  <td>{STREAM_LABELS[stream]}</td>
                  <td className="num">{formatKrw(statement.revenueByStream[stream])}</td>
                  <td className="num">{formatKrw(previous.revenueByStream[stream])}</td>
                  <td className="num">{formatKrw(statement.revenueByStream[stream] - previous.revenueByStream[stream])}</td>
                </tr>
              ))}
              <tr className="section">
                <td>비용</td>
                <td className="num">({formatKrw(statement.expenseTotal)})</td>
                <td className="num">({formatKrw(previous.expenseTotal)})</td>
                <td className="num">{formatKrw(statement.expenseTotal - previous.expenseTotal)}</td>
              </tr>
              {EXPENSE_TYPES.map((type) => (
                <tr className="indent" key={type}>
                  <td>{EXPENSE_LABELS[type]}</td>
                  <td className="num">({formatKrw(statement.expenseByType[type])})</td>
                  <td className="num">({formatKrw(previous.expenseByType[type])})</td>
                  <td className="num">{formatKrw(statement.expenseByType[type] - previous.expenseByType[type])}</td>
                </tr>
              ))}
              <tr className="section">
                <td>직원 인센티브</td>
                <td className="num">({formatKrw(statement.incentiveTotal)})</td>
                <td className="num">({formatKrw(previous.incentiveTotal)})</td>
                <td className="num">{formatKrw(statement.incentiveTotal - previous.incentiveTotal)}</td>
              </tr>
              <tr className="total">
                <td>순이익</td>
                <td className="num">{formatKrw(statement.netProfit)}</td>
                <td className="num">{formatKrw(previous.netProfit)}</td>
                <td className="num">{formatKrw(statement.netProfit - previous.netProfit)}</td>
              </tr>
              <tr>
                <td>순이익률</td>
                <td className="num">{formatPct(statement.marginPct)}</td>
                <td className="num">{formatPct(previous.marginPct)}</td>
                <td className="num">
                  {statement.marginPct !== null && previous.marginPct !== null ? `${(statement.marginPct - previous.marginPct).toFixed(1)}%p` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
      ) : null}

      {pnl ? (
        <Section title="최근 6개월 순이익 추이" description="막대는 매출(연한 색)과 비용+인센티브(진한 색), 숫자는 순이익입니다.">
          <div className="v3-chart-card">
            <svg viewBox="0 0 720 200" width="100%" height={200} role="img" aria-label="6개월 순이익 추이">
              {pnl.trend.map((point, index) => {
                const slot = 720 / pnl.trend.length
                const x = slot * index + slot / 2
                const barW = Math.min(slot * 0.28, 34)
                const revH = (point.revenue / trendMax) * 130
                const costH = ((point.expense + point.incentive) / trendMax) * 130
                return (
                  <g key={point.month}>
                    <title>{`${point.month} 매출 ${formatKrw(point.revenue)} / 비용+인센티브 ${formatKrw(point.expense + point.incentive)} / 순이익 ${formatKrw(point.net)}`}</title>
                    <rect x={x - barW - 2} y={160 - revH} width={barW} height={revH} fill="#3b6fe0" opacity={0.35} rx={2} />
                    <rect x={x + 2} y={160 - costH} width={barW} height={costH} fill="#e0574b" opacity={0.7} rx={2} />
                    <text x={x} y={160 - Math.max(revH, costH) - 8} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: point.net >= 0 ? '#1f7a52' : '#b8392f' }}>
                      {formatKrwCompact(point.net)}
                    </text>
                    <text x={x} y={182} textAnchor="middle" className="v3-bar-tip">
                      {formatMonthShort(point.month)}
                    </text>
                  </g>
                )
              })}
              <line x1={0} x2={720} y1={160} y2={160} stroke="#edece9" />
            </svg>
          </div>
        </Section>
      ) : null}
    </>
  )
}
