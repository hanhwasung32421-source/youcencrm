'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/v3/app-shell'
import { Toast, useToast } from '@/components/toast'
import { Callout, DocRow, DocTable, SampleBanner, Section, Tag, type DocColumn } from '@/components/v3/ui'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { computeIncentive, type IncentiveRule } from '@/lib/v3/finance'
import { formatDateTime, formatKrw } from '@/lib/v3/format'

type RuleFields = Omit<IncentiveRule, 'user_id'>

type Row = {
  userId: string
  name: string
  roleType: string
  ruleIsDefault: boolean
  rule: RuleFields & { updated_at: string | null }
}

type Response = { sample: boolean; defaults: RuleFields; rows: Row[]; error?: string }

type Draft = { base_pay: string; per_video: string; per_1k_views: string; longform_weight: string; shortform_weight: string }

const COLUMNS: DocColumn[] = [
  { key: 'name', label: '직원', width: '120px' },
  { key: 'base', label: '기본급 (원)', width: 'minmax(110px, 1fr)' },
  { key: 'video', label: '영상당 단가 (원)', width: 'minmax(110px, 1fr)' },
  { key: 'views', label: '1,000회당 단가 (원)', width: 'minmax(110px, 1fr)' },
  { key: 'long', label: '롱폼 가중치', width: '96px' },
  { key: 'short', label: '숏폼 가중치', width: '96px' },
  { key: 'preview', label: '예시 (롱 100 · 숏 100 · 50만뷰)', width: '150px', align: 'right' },
  { key: 'actions', label: '', width: '96px' }
]

function toDraft(rule: RuleFields): Draft {
  return {
    base_pay: String(rule.base_pay),
    per_video: String(rule.per_video),
    per_1k_views: String(rule.per_1k_views),
    longform_weight: String(rule.longform_weight),
    shortform_weight: String(rule.shortform_weight)
  }
}

function fromDraft(draft: Draft): RuleFields {
  const int = (value: string) => Math.max(0, Math.round(Number(String(value).replace(/[^\d]/g, '') || 0)))
  const dec = (value: string) => {
    const n = Number(value)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }
  return {
    base_pay: int(draft.base_pay),
    per_video: int(draft.per_video),
    per_1k_views: int(draft.per_1k_views),
    longform_weight: dec(draft.longform_weight),
    shortform_weight: dec(draft.shortform_weight)
  }
}

// 예시 영상 세트: 롱폼 100개 + 숏폼 100개, 합계 조회수 50만 (각 2,500회)
const PREVIEW_VIDEOS = Array.from({ length: 200 }, (_, i) => ({
  id: `p${i}`,
  title: null,
  stock_name: null,
  content_type: (i < 100 ? 'longform' : 'shortform') as 'longform' | 'shortform',
  view_count: 2500,
  published_at: null,
  created_at: '',
  youtube_url: null,
  primary_owner_user_id: ''
}))

export default function IncentiveRulesPage() {
  const { toast, showSuccess, showError } = useToast()
  const [data, setData] = useState<Response | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { ok, data } = await authedFetchJson<Response>('/api/v3/incentive-rules')
    if (!ok || data?.error) {
      showError(data?.error || '규칙 조회에 실패했습니다.')
      return
    }
    setData(data)
    setDrafts(Object.fromEntries(data.rows.map((row) => [row.userId, toDraft(row.rule)])))
  }, [showError])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (row: Row) => {
    const draft = drafts[row.userId]
    if (!draft) return
    setSavingId(row.userId)
    const { ok, data: res } = await authedPostJson<{ error?: string }>('/api/v3/incentive-rules', { user_id: row.userId, ...fromDraft(draft) })
    setSavingId(null)
    if (!ok || res?.error) {
      showError(res?.error || '저장에 실패했습니다.')
      return
    }
    showSuccess(`${row.name}의 규칙을 저장했습니다.`)
    await load()
  }

  const isDirty = (row: Row) => {
    const draft = drafts[row.userId]
    if (!draft) return false
    const next = fromDraft(draft)
    return (
      next.base_pay !== row.rule.base_pay ||
      next.per_video !== row.rule.per_video ||
      next.per_1k_views !== row.rule.per_1k_views ||
      next.longform_weight !== row.rule.longform_weight ||
      next.shortform_weight !== row.rule.shortform_weight
    )
  }

  const update = (userId: string, key: keyof Draft, value: string) => {
    setDrafts((prev) => ({ ...prev, [userId]: { ...(prev[userId] || toDraft(data?.defaults || { base_pay: 0, per_video: 0, per_1k_views: 0, longform_weight: 1, shortform_weight: 0.5 })), [key]: value } }))
  }

  const rows = data?.rows || []

  return (
    <>
      <PageHeader icon="⚙️" title="인센티브 규칙" subtitle="직원별 기본급 · 영상당 단가 · 조회수 단가 · 롱폼/숏폼 가중치를 설정합니다." />
      <Toast toast={toast} />
      <SampleBanner show={!!data?.sample} />

      {data ? (
        <Callout icon="ℹ️" tone="info">
          규칙이 저장되지 않은 직원은 <strong>기본 규칙</strong>(기본급 {formatKrw(data.defaults.base_pay)} · 영상당 {formatKrw(data.defaults.per_video)} · 1,000회당{' '}
          {formatKrw(data.defaults.per_1k_views)} · 롱폼 ×{data.defaults.longform_weight} · 숏폼 ×{data.defaults.shortform_weight})으로 계산됩니다. 값을 고친 뒤 행의
          저장 버튼을 눌러 주세요.
        </Callout>
      ) : null}

      <Section title="직원별 규칙" count={rows.length} description="예시 열은 롱폼 100개 + 숏폼 100개, 합계 조회수 50만 회를 가정한 월 정산액입니다.">
        <DocTable columns={COLUMNS} isEmpty={rows.length === 0} empty="재직 중인 직원이 없습니다.">
          {rows.map((row) => {
            const draft = drafts[row.userId] || toDraft(row.rule)
            const preview = computeIncentive(fromDraft(draft), PREVIEW_VIDEOS)
            const dirty = isDirty(row)
            const saving = savingId === row.userId
            return (
              <DocRow columns={COLUMNS} key={row.userId} className={dirty ? 'v3-row-editing' : ''}>
                <div>
                  <div className="v3-cell-main">{row.name}</div>
                  <div className="v3-cell-sub">
                    {row.ruleIsDefault ? <Tag tone="gray">기본 규칙</Tag> : row.rule.updated_at ? formatDateTime(row.rule.updated_at) : null}
                  </div>
                </div>
                <input className="input" inputMode="numeric" value={draft.base_pay} onChange={(e) => update(row.userId, 'base_pay', e.target.value)} />
                <input className="input" inputMode="numeric" value={draft.per_video} onChange={(e) => update(row.userId, 'per_video', e.target.value)} />
                <input className="input" inputMode="numeric" value={draft.per_1k_views} onChange={(e) => update(row.userId, 'per_1k_views', e.target.value)} />
                <input className="input" inputMode="decimal" value={draft.longform_weight} onChange={(e) => update(row.userId, 'longform_weight', e.target.value)} />
                <input className="input" inputMode="decimal" value={draft.shortform_weight} onChange={(e) => update(row.userId, 'shortform_weight', e.target.value)} />
                <div className="data-right" style={{ fontWeight: 600 }}>
                  {formatKrw(preview.amount)}
                </div>
                <div className="v3-cell-actions">
                  <button className="button xs" onClick={() => save(row)} disabled={saving || (!dirty && !row.ruleIsDefault)}>
                    {saving ? '저장 중…' : '저장'}
                  </button>
                </div>
              </DocRow>
            )
          })}
        </DocTable>
      </Section>
    </>
  )
}
