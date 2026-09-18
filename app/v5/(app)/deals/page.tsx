'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/v5/app-shell'
import { DealStageBadge, Drawer, EmptyState, Field, SampleBanner, WidgetCard } from '@/components/v5/ui'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { authedDeleteJson, authedPatchJson } from '@/lib/v5/client'
import { diffDays, formatDate, formatKrw, formatKrwCompact, todayYmd } from '@/lib/v5/format'
import { DEAL_STAGES, DEAL_STAGE_LABEL, type Deal, type DealStage, type StaffUser } from '@/lib/v5/types'

type ListResponse = {
  sample?: boolean
  items: Deal[]
  partners: Array<{ id: string; company_name: string; status?: string }>
  users: StaffUser[]
  error?: string
}

type FormState = {
  partner_id: string
  campaign_name: string
  stage: DealStage
  expected_amount: string
  owner_user_id: string
  planned_publish_on: string
  next_action: string
  next_action_on: string
}

const EMPTY_FORM: FormState = {
  partner_id: '',
  campaign_name: '',
  stage: 'lead',
  expected_amount: '',
  owner_user_id: '',
  planned_publish_on: '',
  next_action: '',
  next_action_on: ''
}

const PIPELINE: DealStage[] = ['lead', 'proposal', 'negotiation', 'contract', 'executing']

function nextStage(stage: DealStage): DealStage | null {
  const idx = PIPELINE.indexOf(stage)
  if (idx < 0) return null
  return idx === PIPELINE.length - 1 ? 'won' : PIPELINE[idx + 1]
}

function prevStage(stage: DealStage): DealStage | null {
  const idx = PIPELINE.indexOf(stage)
  return idx > 0 ? PIPELINE[idx - 1] : null
}

export default function DealsPage() {
  const { toast, showSuccess, showError } = useToast()
  const [items, setItems] = useState<Deal[]>([])
  const [partners, setPartners] = useState<ListResponse['partners']>([])
  const [users, setUsers] = useState<StaffUser[]>([])
  const [sample, setSample] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [search, setSearch] = useState('')

  const [drawer, setDrawer] = useState<{ mode: 'create' } | { mode: 'edit'; id: string } | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [closing, setClosing] = useState<{ id: string; stage: 'won' | 'lost'; reason: string } | null>(null)

  const load = async () => {
    const { ok, data } = await authedFetchJson<ListResponse>('/api/v5/deals')
    setLoaded(true)
    if (!ok || data?.error) {
      showError(data?.error || '딜 목록 조회 실패')
      return
    }
    setItems(data.items || [])
    setPartners(data.partners || [])
    setUsers(data.users || [])
    setSample(Boolean(data.sample))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const today = todayYmd()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((d) => {
      if (ownerFilter && d.owner_user_id !== ownerFilter) return false
      if (!q) return true
      return `${d.campaign_name} ${d.partner_name || ''}`.toLowerCase().includes(q)
    })
  }, [items, ownerFilter, search])

  const byStage = useMemo(() => {
    const map = new Map<DealStage, Deal[]>()
    for (const stage of DEAL_STAGES) map.set(stage, [])
    for (const d of filtered) map.get(d.stage)?.push(d)
    return map
  }, [filtered])

  const totals = useMemo(() => {
    const open = filtered.filter((d) => PIPELINE.includes(d.stage))
    return {
      openCount: open.length,
      openAmount: open.reduce((s, d) => s + (d.expected_amount || 0), 0),
      wonAmount: filtered.filter((d) => d.stage === 'won').reduce((s, d) => s + (d.expected_amount || 0), 0),
      overdue: open.filter((d) => d.next_action_on && d.next_action_on < today).length
    }
  }, [filtered, today])

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, partner_id: partners[0]?.id || '' })
    setDrawer({ mode: 'create' })
  }

  const openEdit = (d: Deal) => {
    setForm({
      partner_id: d.partner_id,
      campaign_name: d.campaign_name,
      stage: d.stage,
      expected_amount: String(d.expected_amount || 0),
      owner_user_id: d.owner_user_id || '',
      planned_publish_on: d.planned_publish_on || '',
      next_action: d.next_action || '',
      next_action_on: d.next_action_on || ''
    })
    setDrawer({ mode: 'edit', id: d.id })
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  const submit = async () => {
    if (!drawer) return
    if (!form.partner_id) {
      showError('파트너를 선택해 주세요.')
      return
    }
    if (!form.campaign_name.trim()) {
      showError('캠페인명을 입력해 주세요.')
      return
    }
    setSaving(true)
    const payload = {
      ...form,
      campaign_name: form.campaign_name.trim(),
      expected_amount: Number(form.expected_amount.replace(/[^\d]/g, '') || 0)
    }
    const res =
      drawer.mode === 'create'
        ? await authedPostJson<{ item?: Deal; error?: string }>('/api/v5/deals', payload)
        : await authedPatchJson<{ item?: Deal; error?: string }>(`/api/v5/deals/${drawer.id}`, payload)
    setSaving(false)
    if (!res.ok || res.data?.error) {
      showError(res.data?.error || '저장 실패')
      return
    }
    showSuccess(drawer.mode === 'create' ? '딜을 등록했습니다.' : '딜을 수정했습니다.')
    setDrawer(null)
    await load()
  }

  const moveStage = async (d: Deal, stage: DealStage, close_reason?: string) => {
    setBusyId(d.id)
    const res = await authedPatchJson<{ item?: Deal; error?: string }>(`/api/v5/deals/${d.id}`, close_reason !== undefined ? { stage, close_reason } : { stage })
    setBusyId(null)
    if (!res.ok || res.data?.error) {
      showError(res.data?.error || '단계 변경 실패')
      return
    }
    showSuccess(`"${d.campaign_name}" → ${DEAL_STAGE_LABEL[stage]}`)
    setClosing(null)
    await load()
  }

  const remove = async (d: Deal) => {
    if (!window.confirm(`"${d.campaign_name}" 딜을 삭제할까요?`)) return
    setBusyId(d.id)
    const res = await authedDeleteJson<{ ok?: boolean; error?: string }>(`/api/v5/deals/${d.id}`)
    setBusyId(null)
    if (!res.ok || res.data?.error) {
      showError(res.data?.error || '삭제 실패')
      return
    }
    showSuccess('딜을 삭제했습니다.')
    await load()
  }

  const renderCard = (d: Deal) => {
    const busy = busyId === d.id
    const next = nextStage(d.stage)
    const prev = prevStage(d.stage)
    const overdue = d.next_action_on && d.next_action_on < today && PIPELINE.includes(d.stage)
    return (
      <article className="v5-deal-card" key={d.id}>
        <div className="v5-deal-card-title">{d.campaign_name}</div>
        <div className="v5-deal-card-meta">
          <span>{d.partner_name}</span>
          <span className="v5-deal-card-amount">{formatKrw(d.expected_amount)}</span>
        </div>
        <div className="v5-deal-card-meta">
          <span>담당 {d.owner_name || '미지정'}</span>
          <span>게시 {d.planned_publish_on ? formatDate(d.planned_publish_on) : '-'}</span>
        </div>
        {d.next_action && PIPELINE.includes(d.stage) ? (
          <div className="v5-deal-card-next">
            <span style={{ fontWeight: 700 }}>다음:</span> {d.next_action}
            {d.next_action_on ? (
              <span className={`v5-badge plain ${overdue ? 'red' : ''}`} style={{ marginLeft: 6 }}>
                {overdue ? `지연 ${diffDays(d.next_action_on, today)}일` : diffDays(today, d.next_action_on) === 0 ? '오늘' : `D-${diffDays(today, d.next_action_on)}`}
              </span>
            ) : null}
          </div>
        ) : null}
        {d.close_reason ? <div className="v5-deal-card-next">사유: {d.close_reason}</div> : null}
        <div className="v5-deal-card-actions">
          {prev ? (
            <button className="button secondary xs" disabled={busy} onClick={() => void moveStage(d, prev)}>
              ←
            </button>
          ) : null}
          {next && next !== 'won' ? (
            <button className="button xs" disabled={busy} onClick={() => void moveStage(d, next)}>
              {DEAL_STAGE_LABEL[next]} →
            </button>
          ) : null}
          {next === 'won' ? (
            <button className="button success xs" disabled={busy} onClick={() => setClosing({ id: d.id, stage: 'won', reason: '' })}>
              완료
            </button>
          ) : null}
          {PIPELINE.includes(d.stage) ? (
            <button className="button secondary xs" disabled={busy} onClick={() => setClosing({ id: d.id, stage: 'lost', reason: '' })}>
              실패
            </button>
          ) : (
            <button className="button secondary xs" disabled={busy} onClick={() => void moveStage(d, 'negotiation')}>
              다시 열기
            </button>
          )}
          <button className="button ghost xs" disabled={busy} onClick={() => openEdit(d)}>
            수정
          </button>
        </div>
      </article>
    )
  }

  const closingDeal = closing ? items.find((d) => d.id === closing.id) : null

  return (
    <>
      <PageHeader
        title="딜 파이프라인"
        subtitle="리드 → 제안 → 협상 → 계약 → 집행 중 → 완료 / 실패. 단계 버튼으로 이동하고, 닫을 때 사유를 남깁니다."
        actions={
          <>
            <div className="v5-segment">
              <button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}>
                칸반
              </button>
              <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
                목록
              </button>
            </div>
            <button className="button sm" onClick={openCreate}>
              + 딜 추가
            </button>
          </>
        }
      />
      <Toast toast={toast} />
      <SampleBanner show={sample} />

      <div className="grid grid-4">
        <div className="v5-kpi">
          <div className="v5-kpi-label">진행 중 딜</div>
          <div className="v5-kpi-value">
            {totals.openCount}
            <small>건</small>
          </div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-label">파이프라인 금액</div>
          <div className="v5-kpi-value" title={formatKrw(totals.openAmount)}>
            {formatKrwCompact(totals.openAmount)}
            <small>원</small>
          </div>
        </div>
        <div className="v5-kpi tone-green">
          <div className="v5-kpi-label">완료 금액</div>
          <div className="v5-kpi-value" title={formatKrw(totals.wonAmount)}>
            {formatKrwCompact(totals.wonAmount)}
            <small>원</small>
          </div>
        </div>
        <div className={`v5-kpi ${totals.overdue > 0 ? 'tone-red' : ''}`}>
          <div className="v5-kpi-label">다음 액션 지연</div>
          <div className="v5-kpi-value">
            {totals.overdue}
            <small>건</small>
          </div>
        </div>
      </div>

      <WidgetCard
        icon="⇶"
        title={view === 'kanban' ? '칸반 보드' : '딜 목록'}
        subtitle={`${filtered.length}건 표시`}
        menu={
          <div className="v5-toolbar">
            <input className="input search" placeholder="캠페인 · 파트너 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="select" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
              <option value="">담당 전체</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        }
        footer="카드의 → 버튼은 다음 단계로, ← 버튼은 이전 단계로 이동합니다"
      >
        {loaded && filtered.length === 0 ? <EmptyState>표시할 딜이 없습니다. 오른쪽 위 "딜 추가"로 시작하세요.</EmptyState> : null}
        {view === 'kanban' && filtered.length > 0 ? (
          <div className="v5-kanban">
            {DEAL_STAGES.map((stage) => {
              const list = byStage.get(stage) || []
              const amount = list.reduce((s, d) => s + (d.expected_amount || 0), 0)
              return (
                <div className="v5-kanban-col" key={stage}>
                  <div className="v5-kanban-col-head">
                    <div className="v5-kanban-col-title">
                      {DEAL_STAGE_LABEL[stage]}
                      <span>{list.length}</span>
                    </div>
                    <div className="v5-kanban-col-total" title={formatKrw(amount)}>
                      {formatKrwCompact(amount)}
                    </div>
                  </div>
                  {list.map(renderCard)}
                </div>
              )
            })}
          </div>
        ) : null}
        {view === 'list' && filtered.length > 0 ? (
          <div className="v5-table-wrap">
            <table className="v5-table">
              <thead>
                <tr>
                  <th>캠페인</th>
                  <th>파트너</th>
                  <th>단계</th>
                  <th className="num">예상 금액</th>
                  <th>담당</th>
                  <th>예정 게시일</th>
                  <th>다음 액션</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...filtered]
                  .sort((a, b) => DEAL_STAGES.indexOf(a.stage) - DEAL_STAGES.indexOf(b.stage))
                  .map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 700 }}>{d.campaign_name}</td>
                      <td>{d.partner_name}</td>
                      <td>
                        <DealStageBadge stage={d.stage} />
                      </td>
                      <td className="num">{formatKrw(d.expected_amount)}</td>
                      <td>{d.owner_name || '-'}</td>
                      <td>{formatDate(d.planned_publish_on)}</td>
                      <td>
                        {d.next_action ? (
                          <>
                            {d.next_action} <span className="muted">({formatDate(d.next_action_on)})</span>
                          </>
                        ) : d.close_reason ? (
                          <span className="muted">사유: {d.close_reason}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          <button className="button secondary xs" disabled={busyId === d.id} onClick={() => openEdit(d)}>
                            수정
                          </button>
                          <button className="button ghost xs" disabled={busyId === d.id} onClick={() => void remove(d)}>
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </WidgetCard>

      <Drawer
        open={Boolean(drawer)}
        title={drawer?.mode === 'edit' ? '딜 수정' : '딜 추가'}
        onClose={() => (saving ? null : setDrawer(null))}
        footer={
          <>
            {drawer?.mode === 'edit' ? (
              <button
                className="button ghost"
                disabled={saving}
                style={{ marginRight: 'auto' }}
                onClick={() => {
                  const d = items.find((x) => x.id === drawer.id)
                  if (d) {
                    setDrawer(null)
                    void remove(d)
                  }
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
          <Field label="파트너" full>
            <select className="select" value={form.partner_id} onChange={(e) => update('partner_id', e.target.value)}>
              <option value="">선택</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="캠페인명" full>
            <input className="input" value={form.campaign_name} onChange={(e) => update('campaign_name', e.target.value)} placeholder="예: 4분기 신규 계좌 이벤트 롱폼 4편" />
          </Field>
          <Field label="단계">
            <select className="select" value={form.stage} onChange={(e) => update('stage', e.target.value as DealStage)}>
              {PIPELINE.map((s) => (
                <option key={s} value={s}>
                  {DEAL_STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="예상 금액 (원)">
            <input className="input" inputMode="numeric" value={form.expected_amount} onChange={(e) => update('expected_amount', e.target.value.replace(/[^\d]/g, ''))} placeholder="15000000" />
          </Field>
          <Field label="담당 직원">
            <select className="select" value={form.owner_user_id} onChange={(e) => update('owner_user_id', e.target.value)}>
              <option value="">미지정</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="예정 게시일">
            <input className="input" type="date" value={form.planned_publish_on} onChange={(e) => update('planned_publish_on', e.target.value)} />
          </Field>
          <Field label="다음 액션">
            <input className="input" value={form.next_action} onChange={(e) => update('next_action', e.target.value)} placeholder="제안서 송부" />
          </Field>
          <Field label="다음 액션 날짜">
            <input className="input" type="date" value={form.next_action_on} onChange={(e) => update('next_action_on', e.target.value)} />
          </Field>
        </div>
      </Drawer>

      <Drawer
        open={Boolean(closing)}
        title={closing?.stage === 'won' ? '딜 완료 처리' : '딜 실패 처리'}
        onClose={() => (busyId ? null : setClosing(null))}
        footer={
          <>
            <button className="button secondary" disabled={Boolean(busyId)} onClick={() => setClosing(null)}>
              취소
            </button>
            <button
              className={`button ${closing?.stage === 'won' ? 'success' : 'danger'}`}
              disabled={Boolean(busyId) || !closing?.reason.trim()}
              onClick={() => {
                if (closingDeal && closing) void moveStage(closingDeal, closing.stage, closing.reason.trim())
              }}
            >
              {closing?.stage === 'won' ? '완료로 이동' : '실패로 이동'}
            </button>
          </>
        }
      >
        {closingDeal ? (
          <>
            <div className="v5-deal-card">
              <div className="v5-deal-card-title">{closingDeal.campaign_name}</div>
              <div className="v5-deal-card-meta">
                <span>{closingDeal.partner_name}</span>
                <span className="v5-deal-card-amount">{formatKrw(closingDeal.expected_amount)}</span>
              </div>
            </div>
            <Field label={closing?.stage === 'won' ? '완료 사유 · 성과 요약' : '실패 사유'}>
              <textarea
                className="textarea"
                value={closing?.reason || ''}
                onChange={(e) => setClosing((prev) => (prev ? { ...prev, reason: e.target.value } : prev))}
                placeholder={closing?.stage === 'won' ? '전 편 집행 완료, 정산 마감' : '광고주 예산 축소 / 경쟁 채널 선정 등'}
              />
            </Field>
          </>
        ) : null}
      </Drawer>
    </>
  )
}
