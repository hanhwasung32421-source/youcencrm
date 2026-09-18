'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/v5/app-shell'
import { Drawer, EmptyState, Field, GradeChip, PartnerStatusBadge, SampleBanner, WidgetCard } from '@/components/v5/ui'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { authedPatchJson } from '@/lib/v5/client'
import { formatKrw } from '@/lib/v5/format'
import {
  PARTNER_GRADES,
  PARTNER_STATUSES,
  PARTNER_STATUS_LABEL,
  PARTNER_TYPES,
  PARTNER_TYPE_LABEL,
  type Partner,
  type PartnerGrade,
  type PartnerStatus,
  type PartnerType
} from '@/lib/v5/types'

type ListResponse = { sample?: boolean; items: Partner[]; error?: string }

type FormState = {
  company_name: string
  partner_type: PartnerType
  grade: PartnerGrade
  contact_name: string
  contact_email: string
  contact_phone: string
  tags: string
  status: PartnerStatus
  memo: string
}

const EMPTY_FORM: FormState = {
  company_name: '',
  partner_type: 'advertiser',
  grade: 'B',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  tags: '',
  status: 'active',
  memo: ''
}

function toForm(p: Partner): FormState {
  return {
    company_name: p.company_name,
    partner_type: p.partner_type,
    grade: p.grade,
    contact_name: p.contact_name || '',
    contact_email: p.contact_email || '',
    contact_phone: p.contact_phone || '',
    tags: (p.tags || []).join(', '),
    status: p.status,
    memo: p.memo || ''
  }
}

export default function PartnersPage() {
  const router = useRouter()
  const { toast, showSuccess, showError } = useToast()
  const [items, setItems] = useState<Partner[]>([])
  const [sample, setSample] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | PartnerType>('')
  const [gradeFilter, setGradeFilter] = useState<'' | PartnerGrade>('')
  const [statusFilter, setStatusFilter] = useState<'' | PartnerStatus>('active')

  const [drawer, setDrawer] = useState<{ mode: 'create' } | { mode: 'edit'; id: string } | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { ok, data } = await authedFetchJson<ListResponse>('/api/v5/partners')
    setLoaded(true)
    if (!ok || data?.error) {
      showError(data?.error || '파트너 목록 조회 실패')
      return
    }
    setItems(data.items || [])
    setSample(Boolean(data.sample))
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((p) => {
      if (typeFilter && p.partner_type !== typeFilter) return false
      if (gradeFilter && p.grade !== gradeFilter) return false
      if (statusFilter && p.status !== statusFilter) return false
      if (!q) return true
      const hay = [p.company_name, p.contact_name, p.contact_email, p.contact_phone, ...(p.tags || [])].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [items, search, typeFilter, gradeFilter, statusFilter])

  const totals = useMemo(
    () => ({
      active: items.filter((p) => p.status === 'active').length,
      won: items.reduce((s, p) => s + (p.won_amount || 0), 0),
      open: items.reduce((s, p) => s + (p.open_deal_count || 0), 0)
    }),
    [items]
  )

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setDrawer({ mode: 'create' })
  }

  const openEdit = (p: Partner) => {
    setForm(toForm(p))
    setDrawer({ mode: 'edit', id: p.id })
  }

  const submit = async () => {
    if (!drawer) return
    if (!form.company_name.trim()) {
      showError('회사명을 입력해 주세요.')
      return
    }
    setSaving(true)
    const payload = {
      ...form,
      company_name: form.company_name.trim(),
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    }
    const res =
      drawer.mode === 'create'
        ? await authedPostJson<{ item?: Partner; error?: string }>('/api/v5/partners', payload)
        : await authedPatchJson<{ item?: Partner; error?: string }>(`/api/v5/partners/${drawer.id}`, payload)
    setSaving(false)
    if (!res.ok || res.data?.error) {
      showError(res.data?.error || '저장 실패')
      return
    }
    showSuccess(drawer.mode === 'create' ? '파트너를 등록했습니다.' : '파트너 정보를 수정했습니다.')
    setDrawer(null)
    await load()
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <>
      <PageHeader
        title="파트너 · 광고주"
        subtitle="광고주, 증권사, PR대행사, 플랫폼 파트너의 담당자와 등급, 누적 계약액을 관리합니다."
        actions={
          <button className="button sm" onClick={openCreate}>
            + 파트너 등록
          </button>
        }
      />
      <Toast toast={toast} />
      <SampleBanner show={sample} />

      <div className="grid grid-3">
        <div className="v5-kpi">
          <div className="v5-kpi-label">활성 파트너</div>
          <div className="v5-kpi-value">
            {totals.active}
            <small>/ {items.length}사</small>
          </div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-label">누적 성사 계약액</div>
          <div className="v5-kpi-value" style={{ fontSize: 22 }}>
            {formatKrw(totals.won)}
          </div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-label">진행 중 딜</div>
          <div className="v5-kpi-value">
            {totals.open}
            <small>건</small>
          </div>
        </div>
      </div>

      <WidgetCard
        icon="◎"
        title="파트너 목록"
        subtitle={`${filtered.length}사 표시`}
        menu={
          <div className="v5-toolbar">
            <input className="input search" placeholder="회사명 · 담당자 · 태그 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as '' | PartnerType)}>
              <option value="">유형 전체</option>
              {PARTNER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PARTNER_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <select className="select" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value as '' | PartnerGrade)}>
              <option value="">등급 전체</option>
              {PARTNER_GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}등급
                </option>
              ))}
            </select>
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | PartnerStatus)}>
              <option value="">상태 전체</option>
              {PARTNER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PARTNER_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        }
        footer={`전체 ${items.length}사 · 행을 누르면 상세(딜 · 계약 · 활동)로 이동합니다`}
      >
        {loaded && filtered.length === 0 ? <EmptyState>조건에 맞는 파트너가 없습니다.</EmptyState> : null}
        {filtered.length > 0 ? (
          <div className="v5-table-wrap">
            <table className="v5-table">
              <thead>
                <tr>
                  <th>회사명</th>
                  <th>유형</th>
                  <th>등급</th>
                  <th>담당자</th>
                  <th>태그</th>
                  <th>상태</th>
                  <th className="num">진행 딜</th>
                  <th className="num">누적 계약액</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => router.push(`/v5/partners/${p.id}`)}>
                    <td style={{ fontWeight: 700 }}>{p.company_name}</td>
                    <td>{PARTNER_TYPE_LABEL[p.partner_type]}</td>
                    <td>
                      <GradeChip grade={p.grade} />
                    </td>
                    <td>
                      <div>{p.contact_name || '-'}</div>
                      <div className="small muted">{[p.contact_email, p.contact_phone].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td>
                      <div className="row wrap" style={{ gap: 4 }}>
                        {(p.tags || []).slice(0, 4).map((t) => (
                          <span className="v5-tag" key={t}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <PartnerStatusBadge status={p.status} />
                    </td>
                    <td className="num">{p.open_deal_count || 0}</td>
                    <td className="num">{formatKrw(p.won_amount || 0)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="button secondary xs" onClick={() => openEdit(p)}>
                        수정
                      </button>
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
        title={drawer?.mode === 'edit' ? '파트너 수정' : '파트너 등록'}
        onClose={() => (saving ? null : setDrawer(null))}
        footer={
          <>
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
          <Field label="회사명" full>
            <input className="input" value={form.company_name} onChange={(e) => update('company_name', e.target.value)} placeholder="예: 키움증권" />
          </Field>
          <Field label="유형">
            <select className="select" value={form.partner_type} onChange={(e) => update('partner_type', e.target.value as PartnerType)}>
              {PARTNER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PARTNER_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="등급">
            <select className="select" value={form.grade} onChange={(e) => update('grade', e.target.value as PartnerGrade)}>
              {PARTNER_GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}등급
                </option>
              ))}
            </select>
          </Field>
          <Field label="담당자명">
            <input className="input" value={form.contact_name} onChange={(e) => update('contact_name', e.target.value)} />
          </Field>
          <Field label="담당자 전화">
            <input className="input" value={form.contact_phone} onChange={(e) => update('contact_phone', e.target.value)} placeholder="02-0000-0000" />
          </Field>
          <Field label="담당자 이메일" full>
            <input className="input" type="email" value={form.contact_email} onChange={(e) => update('contact_email', e.target.value)} />
          </Field>
          <Field label="태그 (쉼표로 구분)" full>
            <input className="input" value={form.tags} onChange={(e) => update('tags', e.target.value)} placeholder="ETF, 이벤트 협찬, 분기 계약" />
          </Field>
          <Field label="상태">
            <select className="select" value={form.status} onChange={(e) => update('status', e.target.value as PartnerStatus)}>
              {PARTNER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PARTNER_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="메모" full>
            <textarea className="textarea" value={form.memo} onChange={(e) => update('memo', e.target.value)} placeholder="선호 포맷, 주의사항 등" />
          </Field>
        </div>
      </Drawer>
    </>
  )
}
