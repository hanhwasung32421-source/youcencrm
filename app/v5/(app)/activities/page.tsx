'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageHeader, useV5Me } from '@/components/v5/app-shell'
import { Drawer, EmptyState, Field, SampleBanner, WidgetCard } from '@/components/v5/ui'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { authedDeleteJson } from '@/lib/v5/client'
import { formatDate, formatDateTime, toDateTimeLocal, todayYmd } from '@/lib/v5/format'
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABEL, DEAL_STAGE_LABEL, type Activity, type ActivityType, type DealStage } from '@/lib/v5/types'

type ListResponse = {
  sample?: boolean
  items: Activity[]
  partners: Array<{ id: string; company_name: string }>
  deals: Array<{ id: string; partner_id: string; campaign_name: string; stage: DealStage; owner_user_id: string | null }>
  error?: string
}

type FormState = {
  partner_id: string
  deal_id: string
  activity_type: ActivityType
  occurred_at: string
  summary: string
  next_step: string
  next_step_on: string
}

export default function ActivitiesPage() {
  return (
    <Suspense fallback={null}>
      <ActivitiesInner />
    </Suspense>
  )
}

function ActivitiesInner() {
  const me = useV5Me()
  const searchParams = useSearchParams()
  const { toast, showSuccess, showError } = useToast()
  const [items, setItems] = useState<Activity[]>([])
  const [partners, setPartners] = useState<ListResponse['partners']>([])
  const [deals, setDeals] = useState<ListResponse['deals']>([])
  const [sample, setSample] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const [partnerFilter, setPartnerFilter] = useState(searchParams.get('partnerId') || '')
  const [dealFilter, setDealFilter] = useState(searchParams.get('dealId') || '')
  const [typeFilter, setTypeFilter] = useState<'' | ActivityType>('')
  const [search, setSearch] = useState('')

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(() => ({
    partner_id: '',
    deal_id: '',
    activity_type: 'meeting',
    occurred_at: toDateTimeLocal(null),
    summary: '',
    next_step: '',
    next_step_on: ''
  }))
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    const { ok, data } = await authedFetchJson<ListResponse>('/api/v5/activities')
    setLoaded(true)
    if (!ok || data?.error) {
      showError(data?.error || '커뮤니케이션 로그 조회 실패')
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
    return items.filter((a) => {
      if (partnerFilter && a.partner_id !== partnerFilter) return false
      if (dealFilter && a.deal_id !== dealFilter) return false
      if (typeFilter && a.activity_type !== typeFilter) return false
      if (!q) return true
      return `${a.summary} ${a.next_step || ''} ${a.partner_name || ''} ${a.deal_name || ''} ${a.author_name || ''}`.toLowerCase().includes(q)
    })
  }, [items, partnerFilter, dealFilter, typeFilter, search])

  // 날짜별로 묶어서 연대기 피드로 보여준다.
  const grouped = useMemo(() => {
    const map = new Map<string, Activity[]>()
    for (const a of filtered) {
      const key = formatDate(a.occurred_at)
      const list = map.get(key) || []
      list.push(a)
      map.set(key, list)
    }
    return Array.from(map.entries())
  }, [filtered])

  const pendingSteps = useMemo(
    () => items.filter((a) => a.next_step && a.next_step_on && a.next_step_on >= today).sort((a, b) => (a.next_step_on! < b.next_step_on! ? -1 : 1)).slice(0, 6),
    [items, today]
  )

  const typeCounts = useMemo(() => ACTIVITY_TYPES.map((t) => ({ type: t, count: filtered.filter((a) => a.activity_type === t).length })), [filtered])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  const openCreate = () => {
    setForm({
      partner_id: partnerFilter || '',
      deal_id: dealFilter || '',
      activity_type: 'meeting',
      occurred_at: toDateTimeLocal(null),
      summary: '',
      next_step: '',
      next_step_on: ''
    })
    setOpen(true)
  }

  const submit = async () => {
    if (!form.summary.trim()) return showError('요약을 입력해 주세요.')
    if (!form.partner_id && !form.deal_id) return showError('파트너 또는 딜을 선택해 주세요.')
    if (me && !me.isAdmin && !form.deal_id) return showError('직원은 본인이 담당하는 딜을 선택해 주세요.')
    setSaving(true)
    const res = await authedPostJson<{ item?: Activity; error?: string }>('/api/v5/activities', {
      ...form,
      summary: form.summary.trim(),
      occurred_at: new Date(form.occurred_at).toISOString()
    })
    setSaving(false)
    if (!res.ok || res.data?.error) {
      showError(res.data?.error || '저장 실패')
      return
    }
    showSuccess('기록을 남겼습니다.')
    setOpen(false)
    await load()
  }

  const remove = async (a: Activity) => {
    if (!window.confirm('이 기록을 삭제할까요?')) return
    setBusyId(a.id)
    const res = await authedDeleteJson<{ ok?: boolean; error?: string }>(`/api/v5/activities/${a.id}`)
    setBusyId(null)
    if (!res.ok || res.data?.error) {
      showError(res.data?.error || '삭제 실패')
      return
    }
    showSuccess('기록을 삭제했습니다.')
    await load()
  }

  const dealsForForm = deals.filter((d) => !form.partner_id || d.partner_id === form.partner_id)
  const isStaff = me ? !me.isAdmin : false

  return (
    <>
      <PageHeader
        title="커뮤니케이션 로그"
        subtitle={isStaff ? '본인이 담당하는 딜의 미팅 · 통화 · 이메일 · 메신저 · 메모를 기록합니다.' : '파트너 · 딜별 미팅 · 통화 · 이메일 · 메신저 · 메모를 시간순으로 관리합니다.'}
        actions={
          <button className="button sm" onClick={openCreate}>
            + 기록 추가
          </button>
        }
      />
      <Toast toast={toast} />
      <SampleBanner show={sample} />

      <div className="grid grid-3">
        <WidgetCard icon="✎" title="유형별 건수" subtitle="현재 필터 기준" footer={`총 ${filtered.length}건`}>
          <div className="v5-funnel">
            {typeCounts.map((row) => {
              const max = Math.max(1, ...typeCounts.map((r) => r.count))
              return (
                <div className="v5-funnel-row" key={row.type} style={{ gridTemplateColumns: '48px 1fr 40px' }}>
                  <div className="v5-funnel-stage">{ACTIVITY_TYPE_LABEL[row.type]}</div>
                  <div className="v5-funnel-track" style={{ height: 14 }}>
                    <div className="v5-funnel-bar" style={{ width: `${(row.count / max) * 100}%`, padding: 0 }} />
                  </div>
                  <div className="v5-funnel-amount">{row.count}</div>
                </div>
              )
            })}
          </div>
        </WidgetCard>

        <WidgetCard icon="▦" title="다음 할 일" subtitle="기한이 남은 후속 작업" className="span-2" footer={`${pendingSteps.length}건`}>
          {pendingSteps.length === 0 ? <EmptyState>기한이 남은 후속 작업이 없습니다.</EmptyState> : null}
          {pendingSteps.length > 0 ? (
            <div className="v5-feed">
              {pendingSteps.map((a) => (
                <div className="v5-feed-item" key={a.id}>
                  <div className="v5-feed-date">
                    {a.next_step_on!.slice(5).replace('-', '/')}
                    <small>{a.next_step_on === today ? '오늘' : ''}</small>
                  </div>
                  <div>
                    <div className="v5-feed-title">{a.next_step}</div>
                    <div className="v5-feed-sub">
                      {[a.partner_name, a.deal_name].filter(Boolean).join(' · ')} · {a.author_name || '작성자 미상'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </WidgetCard>
      </div>

      <WidgetCard
        icon="≡"
        title="활동 피드"
        subtitle={`${filtered.length}건 · 최신순`}
        menu={
          <div className="v5-toolbar">
            <input className="input search" placeholder="요약 · 담당자 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
            {!isStaff ? (
              <select className="select" value={partnerFilter} onChange={(e) => setPartnerFilter(e.target.value)}>
                <option value="">파트너 전체</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.company_name}
                  </option>
                ))}
              </select>
            ) : null}
            <select className="select" value={dealFilter} onChange={(e) => setDealFilter(e.target.value)}>
              <option value="">딜 전체</option>
              {deals
                .filter((d) => !partnerFilter || d.partner_id === partnerFilter)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.campaign_name}
                  </option>
                ))}
            </select>
            <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as '' | ActivityType)}>
              <option value="">유형 전체</option>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACTIVITY_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        }
        footer="직원은 본인이 쓴 기록만 삭제할 수 있습니다"
      >
        {loaded && grouped.length === 0 ? <EmptyState>조건에 맞는 기록이 없습니다.</EmptyState> : null}
        {grouped.map(([date, list]) => (
          <div key={date} style={{ marginBottom: 12 }}>
            <div className="small muted" style={{ fontWeight: 800, padding: '6px 0', letterSpacing: '0.04em' }}>
              {date}
            </div>
            <div className="v5-feed">
              {list.map((a) => (
                <div className="v5-feed-item" key={a.id} style={{ gridTemplateColumns: '34px 1fr auto' }}>
                  <div className="v5-feed-type">{ACTIVITY_TYPE_LABEL[a.activity_type]}</div>
                  <div>
                    <div className="v5-feed-title">{a.summary}</div>
                    <div className="v5-feed-sub">
                      {formatDateTime(a.occurred_at).slice(11)} · {[a.partner_name, a.deal_name].filter(Boolean).join(' · ') || '연결 없음'} · {a.author_name || '작성자 미상'}
                    </div>
                    {a.next_step ? (
                      <div className="v5-deal-card-next" style={{ marginTop: 6, display: 'inline-block' }}>
                        다음: {a.next_step}
                        {a.next_step_on ? <span className="muted"> · {a.next_step_on}</span> : null}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    {!me || me.isAdmin || a.created_by === me.crmUserId ? (
                      <button className="button ghost xs" disabled={busyId === a.id} onClick={() => void remove(a)}>
                        삭제
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </WidgetCard>

      <Drawer
        open={open}
        title="커뮤니케이션 기록"
        onClose={() => (saving ? null : setOpen(false))}
        footer={
          <>
            <button className="button secondary" disabled={saving} onClick={() => setOpen(false)}>
              취소
            </button>
            <button className="button" disabled={saving} onClick={() => void submit()}>
              {saving ? '저장 중…' : '저장'}
            </button>
          </>
        }
      >
        <div className="v5-form-grid">
          {!isStaff ? (
            <Field label="파트너">
              <select className="select" value={form.partner_id} onChange={(e) => setForm((prev) => ({ ...prev, partner_id: e.target.value, deal_id: '' }))}>
                <option value="">선택 안 함</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.company_name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label={isStaff ? '담당 딜' : '딜'} full={isStaff}>
            <select className="select" value={form.deal_id} onChange={(e) => update('deal_id', e.target.value)}>
              <option value="">{isStaff ? '선택' : '선택 안 함'}</option>
              {dealsForForm.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.campaign_name} ({DEAL_STAGE_LABEL[d.stage]})
                </option>
              ))}
            </select>
          </Field>
          <Field label="유형">
            <select className="select" value={form.activity_type} onChange={(e) => update('activity_type', e.target.value as ActivityType)}>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACTIVITY_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="일시">
            <input className="input" type="datetime-local" value={form.occurred_at} onChange={(e) => update('occurred_at', e.target.value)} />
          </Field>
          <Field label="요약" full>
            <textarea className="textarea" value={form.summary} onChange={(e) => update('summary', e.target.value)} placeholder="논의 내용, 합의 사항, 요청 사항" />
          </Field>
          <Field label="다음 할 일">
            <input className="input" value={form.next_step} onChange={(e) => update('next_step', e.target.value)} placeholder="제안서 수정본 전달" />
          </Field>
          <Field label="기한">
            <input className="input" type="date" value={form.next_step_on} onChange={(e) => update('next_step_on', e.target.value)} />
          </Field>
        </div>
      </Drawer>
    </>
  )
}
