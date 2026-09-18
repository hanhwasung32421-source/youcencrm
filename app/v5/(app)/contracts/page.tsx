'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/v5/app-shell'
import { ContractStatusBadge, Drawer, EmptyState, Field, SampleBanner, WidgetCard } from '@/components/v5/ui'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { authedDeleteJson, authedPatchJson } from '@/lib/v5/client'
import { addDays, diffDays, formatKrw, formatKrwCompact, formatShortDate, todayYmd } from '@/lib/v5/format'
import { CONTRACT_STATUSES, CONTRACT_STATUS_LABEL, type Contract, type ContractStatus } from '@/lib/v5/types'

type ListResponse = {
  sample?: boolean
  items: Contract[]
  partners: Array<{ id: string; company_name: string }>
  deals: Array<{ id: string; partner_id: string; campaign_name: string; expected_amount: number }>
  error?: string
}

type FormState = {
  partner_id: string
  deal_id: string
  campaign_name: string
  amount: string
  starts_on: string
  ends_on: string
  ad_disclosure: boolean
  deliverables: string
  status: ContractStatus
  document_url: string
}

const EMPTY_FORM: FormState = {
  partner_id: '',
  deal_id: '',
  campaign_name: '',
  amount: '',
  starts_on: todayYmd(),
  ends_on: addDays(todayYmd(), 60),
  ad_disclosure: true,
  deliverables: '',
  status: 'draft',
  document_url: ''
}

const TIMELINE_DAYS = 60

export default function ContractsPage() {
  const { toast, showSuccess, showError } = useToast()
  const [items, setItems] = useState<Contract[]>([])
  const [partners, setPartners] = useState<ListResponse['partners']>([])
  const [deals, setDeals] = useState<ListResponse['deals']>([])
  const [sample, setSample] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'' | ContractStatus | 'expiring'>('')
  const [search, setSearch] = useState('')

  const [drawer, setDrawer] = useState<{ mode: 'create' } | { mode: 'edit'; id: string } | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    const { ok, data } = await authedFetchJson<ListResponse>('/api/v5/contracts')
    setLoaded(true)
    if (!ok || data?.error) {
      showError(data?.error || '계약 목록 조회 실패')
      return
    }
    setItems(data.items || [])
    setPartners(data.partners || [])
    setDeals(data.deals || [])
    setSample(Boolean(data.sample))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const today = todayYmd()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((c) => {
      if (statusFilter === 'expiring') {
        const remain = diffDays(today, c.ends_on)
        if (c.status === 'expired' || remain < 0 || remain > 30) return false
      } else if (statusFilter && c.status !== statusFilter) return false
      if (!q) return true
      return `${c.campaign_name} ${c.partner_name || ''}`.toLowerCase().includes(q)
    })
  }, [items, statusFilter, search, today])

  const totals = useMemo(() => {
    const live = items.filter((c) => c.status === 'signed' || c.status === 'executing')
    return {
      liveCount: live.length,
      liveAmount: live.reduce((s, c) => s + (c.amount || 0), 0),
      expiring: items.filter((c) => c.status !== 'expired' && diffDays(today, c.ends_on) >= 0 && diffDays(today, c.ends_on) <= 30).length,
      draft: items.filter((c) => c.status === 'draft').length
    }
  }, [items, today])

  // 앞으로 60일 안에 걸쳐 있는 계약만 타임라인에 그린다.
  const timeline = useMemo(() => {
    const end = addDays(today, TIMELINE_DAYS)
    return items
      .filter((c) => c.status !== 'expired' && c.ends_on >= today && c.starts_on <= end)
      .sort((a, b) => (a.ends_on < b.ends_on ? -1 : 1))
      .slice(0, 12)
  }, [items, today])

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, partner_id: partners[0]?.id || '' })
    setDrawer({ mode: 'create' })
  }

  const openEdit = (c: Contract) => {
    setForm({
      partner_id: c.partner_id,
      deal_id: c.deal_id || '',
      campaign_name: c.campaign_name,
      amount: String(c.amount || 0),
      starts_on: c.starts_on,
      ends_on: c.ends_on,
      ad_disclosure: c.ad_disclosure,
      deliverables: c.deliverables || '',
      status: c.status,
      document_url: c.document_url || ''
    })
    setDrawer({ mode: 'edit', id: c.id })
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  // 딜을 고르면 캠페인명/금액/파트너를 자동으로 채운다.
  const pickDeal = (dealId: string) => {
    const deal = deals.find((d) => d.id === dealId)
    setForm((prev) => ({
      ...prev,
      deal_id: dealId,
      partner_id: deal ? deal.partner_id : prev.partner_id,
      campaign_name: deal && !prev.campaign_name ? deal.campaign_name : prev.campaign_name,
      amount: deal && !prev.amount ? String(deal.expected_amount || 0) : prev.amount
    }))
  }

  const submit = async () => {
    if (!drawer) return
    if (!form.partner_id) return showError('파트너를 선택해 주세요.')
    if (!form.campaign_name.trim()) return showError('캠페인명을 입력해 주세요.')
    if (!form.starts_on || !form.ends_on) return showError('시작일과 종료일을 입력해 주세요.')
    if (form.ends_on < form.starts_on) return showError('종료일은 시작일 이후여야 합니다.')
    setSaving(true)
    const payload = { ...form, campaign_name: form.campaign_name.trim(), amount: Number(form.amount || 0) }
    const res =
      drawer.mode === 'create'
        ? await authedPostJson<{ item?: Contract; error?: string }>('/api/v5/contracts', payload)
        : await authedPatchJson<{ item?: Contract; error?: string }>(`/api/v5/contracts/${drawer.id}`, payload)
    setSaving(false)
    if (!res.ok || res.data?.error) {
      showError(res.data?.error || '저장 실패')
      return
    }
    showSuccess(drawer.mode === 'create' ? '계약을 등록했습니다.' : '계약을 수정했습니다.')
    setDrawer(null)
    await load()
  }

  const setStatus = async (c: Contract, status: ContractStatus) => {
    setBusyId(c.id)
    const res = await authedPatchJson<{ item?: Contract; error?: string }>(`/api/v5/contracts/${c.id}`, { status })
    setBusyId(null)
    if (!res.ok || res.data?.error) {
      showError(res.data?.error || '상태 변경 실패')
      return
    }
    showSuccess(`상태를 "${CONTRACT_STATUS_LABEL[status]}"로 변경했습니다.`)
    await load()
  }

  const remove = async (c: Contract) => {
    if (!window.confirm(`"${c.campaign_name}" 계약을 삭제할까요?`)) return
    setBusyId(c.id)
    const res = await authedDeleteJson<{ ok?: boolean; error?: string }>(`/api/v5/contracts/${c.id}`)
    setBusyId(null)
    if (!res.ok || res.data?.error) {
      showError(res.data?.error || '삭제 실패')
      return
    }
    showSuccess('계약을 삭제했습니다.')
    setDrawer(null)
    await load()
  }

  const dealsForPartner = deals.filter((d) => !form.partner_id || d.partner_id === form.partner_id)

  return (
    <>
      <PageHeader
        title="계약 · 일정"
        subtitle="계약 금액 · 기간 · 광고 고지 방식 · 산출물을 관리하고, 60일 타임라인에서 만료 임박 계약을 확인합니다."
        actions={
          <button className="button sm" onClick={openCreate}>
            + 계약 등록
          </button>
        }
      />
      <Toast toast={toast} />
      <SampleBanner show={sample} />

      <div className="grid grid-4">
        <div className="v5-kpi">
          <div className="v5-kpi-label">유효 계약 (서명·집행)</div>
          <div className="v5-kpi-value">
            {totals.liveCount}
            <small>건</small>
          </div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-label">유효 계약 금액</div>
          <div className="v5-kpi-value" title={formatKrw(totals.liveAmount)}>
            {formatKrwCompact(totals.liveAmount)}
            <small>원</small>
          </div>
        </div>
        <div className={`v5-kpi ${totals.expiring > 0 ? 'tone-amber' : ''}`}>
          <div className="v5-kpi-label">30일 내 만료</div>
          <div className="v5-kpi-value">
            {totals.expiring}
            <small>건</small>
          </div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-label">초안 (서명 대기)</div>
          <div className="v5-kpi-value">
            {totals.draft}
            <small>건</small>
          </div>
        </div>
      </div>

      <WidgetCard icon="▦" title="60일 타임라인" subtitle={`${formatShortDate(today)} ~ ${formatShortDate(addDays(today, TIMELINE_DAYS))} · 만료 30일 전 계약은 주황색`} footer={`${timeline.length}건 표시 (만료 계약 제외)`}>
        {timeline.length === 0 ? <EmptyState>앞으로 60일 안에 걸친 계약이 없습니다.</EmptyState> : <TimelineStrip items={timeline} today={today} />}
      </WidgetCard>

      <WidgetCard
        icon="▤"
        title="계약 목록"
        subtitle={`${filtered.length}건 표시`}
        menu={
          <div className="v5-toolbar">
            <input className="input search" placeholder="캠페인 · 파트너 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="">상태 전체</option>
              <option value="expiring">만료 30일 전</option>
              {CONTRACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CONTRACT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        }
        footer="상태 셀렉트에서 바로 서명완료 → 집행중 → 만료로 바꿀 수 있습니다"
      >
        {loaded && filtered.length === 0 ? <EmptyState>조건에 맞는 계약이 없습니다.</EmptyState> : null}
        {filtered.length > 0 ? (
          <div className="v5-table-wrap">
            <table className="v5-table">
              <thead>
                <tr>
                  <th>파트너</th>
                  <th>캠페인</th>
                  <th className="num">계약금액</th>
                  <th>기간</th>
                  <th>광고 고지</th>
                  <th>산출물</th>
                  <th>상태</th>
                  <th>문서</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const remain = diffDays(today, c.ends_on)
                  const expiringSoon = c.status !== 'expired' && remain >= 0 && remain <= 30
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 700 }}>{c.partner_name}</td>
                      <td>{c.campaign_name}</td>
                      <td className="num">{formatKrw(c.amount)}</td>
                      <td>
                        <div style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {c.starts_on} ~ {c.ends_on}
                        </div>
                        {expiringSoon ? <span className="v5-badge amber">만료 30일 전 · D-{remain}</span> : null}
                      </td>
                      <td>{c.ad_disclosure ? <span className="v5-badge green plain">유료광고 표시</span> : <span className="v5-badge plain">표시 없음</span>}</td>
                      <td className="small">{c.deliverables || '-'}</td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          <ContractStatusBadge status={c.status} />
                          <select
                            className="select"
                            style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
                            value={c.status}
                            disabled={busyId === c.id}
                            onChange={(e) => void setStatus(c, e.target.value as ContractStatus)}
                          >
                            {CONTRACT_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {CONTRACT_STATUS_LABEL[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td>
                        {c.document_url ? (
                          <a className="link small" href={c.document_url} target="_blank" rel="noopener noreferrer">
                            열기 ↗
                          </a>
                        ) : (
                          <span className="muted small">-</span>
                        )}
                      </td>
                      <td>
                        <button className="button secondary xs" disabled={busyId === c.id} onClick={() => openEdit(c)}>
                          수정
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </WidgetCard>

      <Drawer
        open={Boolean(drawer)}
        title={drawer?.mode === 'edit' ? '계약 수정' : '계약 등록'}
        onClose={() => (saving ? null : setDrawer(null))}
        footer={
          <>
            {drawer?.mode === 'edit' ? (
              <button
                className="button ghost"
                disabled={saving}
                style={{ marginRight: 'auto' }}
                onClick={() => {
                  const c = items.find((x) => x.id === drawer.id)
                  if (c) void remove(c)
                }}
              >
                삭제
              </button>
            ) : null}
            <button className="button secondary" disabled={saving} onClick={() => setDrawer(null)}>
              취소
            </button>
            <button className="button" disabled={saving} onClick={() => void submit()}>
              {saving ? '저장 중…' : '저장'}
            </button>
          </>
        }
      >
        <div className="v5-form-grid">
          <Field label="파트너">
            <select className="select" value={form.partner_id} onChange={(e) => update('partner_id', e.target.value)}>
              <option value="">선택</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="연결 딜 (선택)">
            <select className="select" value={form.deal_id} onChange={(e) => pickDeal(e.target.value)}>
              <option value="">없음</option>
              {dealsForPartner.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.campaign_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="캠페인명" full>
            <input className="input" value={form.campaign_name} onChange={(e) => update('campaign_name', e.target.value)} />
          </Field>
          <Field label="계약금액 (원)">
            <input className="input" inputMode="numeric" value={form.amount} onChange={(e) => update('amount', e.target.value.replace(/[^\d]/g, ''))} />
          </Field>
          <Field label="상태">
            <select className="select" value={form.status} onChange={(e) => update('status', e.target.value as ContractStatus)}>
              {CONTRACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CONTRACT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="시작일">
            <input className="input" type="date" value={form.starts_on} onChange={(e) => update('starts_on', e.target.value)} />
          </Field>
          <Field label="종료일">
            <input className="input" type="date" value={form.ends_on} onChange={(e) => update('ends_on', e.target.value)} />
          </Field>
          <Field label="산출물" full>
            <input className="input" value={form.deliverables} onChange={(e) => update('deliverables', e.target.value)} placeholder="롱폼 4편 + 숏폼 8편" />
          </Field>
          <Field label="문서 링크" full>
            <input className="input" value={form.document_url} onChange={(e) => update('document_url', e.target.value)} placeholder="https://drive…" />
          </Field>
          <label className="v5-check full">
            <input type="checkbox" checked={form.ad_disclosure} onChange={(e) => update('ad_disclosure', e.target.checked)} />
            영상에 "유료광고 포함" 표시 (광고 고지 방식)
          </label>
        </div>
      </Drawer>
    </>
  )
}

// 60일 타임라인. 인라인 SVG 로 계약 기간을 막대로 그리고, 만료 30일 전이면 주황색으로 강조한다.
function TimelineStrip({ items, today }: { items: Contract[]; today: string }) {
  const width = 960
  const labelWidth = 220
  const rowHeight = 30
  const headerHeight = 26
  const trackWidth = width - labelWidth - 12
  const dayWidth = trackWidth / TIMELINE_DAYS
  const height = headerHeight + items.length * rowHeight + 8
  const ticks = [0, 7, 14, 21, 28, 35, 42, 49, 56]

  return (
    <div className="v5-timeline">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ minWidth: 720, display: 'block' }} role="img" aria-label="계약 타임라인">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={labelWidth + t * dayWidth} y1={headerHeight - 6} x2={labelWidth + t * dayWidth} y2={height} stroke="#e7e9f2" strokeWidth={1} />
            <text x={labelWidth + t * dayWidth + 3} y={12} fontSize={10} fill="#6b7280" fontWeight={700}>
              {t === 0 ? '오늘' : formatShortDate(addDays(today, t))}
            </text>
          </g>
        ))}
        <line x1={labelWidth + 30 * dayWidth} y1={headerHeight - 6} x2={labelWidth + 30 * dayWidth} y2={height} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} />
        <text x={labelWidth + 30 * dayWidth + 3} y={headerHeight - 9} fontSize={9} fill="#b45309" fontWeight={700}>
          +30일
        </text>
        {items.map((c, i) => {
          const y = headerHeight + i * rowHeight
          const startOffset = Math.max(diffDays(today, c.starts_on), 0)
          const endOffset = Math.min(diffDays(today, c.ends_on), TIMELINE_DAYS)
          const remain = diffDays(today, c.ends_on)
          const expiring = remain <= 30
          const x = labelWidth + startOffset * dayWidth
          const w = Math.max((endOffset - startOffset) * dayWidth, 6)
          const color = expiring ? '#f59e0b' : c.status === 'draft' ? '#c7d2fe' : '#4f46e5'
          return (
            <g key={c.id}>
              <text x={0} y={y + 19} fontSize={12} fontWeight={700} fill="#14161f">
                {c.partner_name && c.partner_name.length > 8 ? `${c.partner_name.slice(0, 8)}…` : c.partner_name}
              </text>
              <text x={80} y={y + 19} fontSize={11} fill="#6b7280">
                {c.campaign_name.length > 16 ? `${c.campaign_name.slice(0, 16)}…` : c.campaign_name}
              </text>
              <rect x={x} y={y + 7} width={w} height={16} rx={5} fill={color} opacity={c.status === 'draft' ? 0.9 : 1}>
                <title>
                  {c.campaign_name} · {c.starts_on} ~ {c.ends_on} · {formatKrw(c.amount)}
                </title>
              </rect>
              {startOffset === 0 && diffDays(today, c.starts_on) < 0 ? <rect x={x} y={y + 7} width={3} height={16} fill="#14161f" opacity={0.25} /> : null}
              <text x={Math.min(x + w + 6, width - 60)} y={y + 19} fontSize={10} fontWeight={700} fill={expiring ? '#b45309' : '#6b7280'}>
                D-{remain}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
