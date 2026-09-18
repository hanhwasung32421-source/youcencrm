'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/v3/app-shell'
import { Toast, useToast } from '@/components/toast'
import { Callout, DocRow, DocTable, KpiCard, MonthPicker, SampleBanner, Section, Tag, type DocColumn } from '@/components/v3/ui'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { formatMonthLabel, getCurrentMonth, type IncentiveBreakdown, type IncentiveRule, type IncentiveSettlement } from '@/lib/v3/finance'
import { formatDateTime, formatKrw, formatNumber } from '@/lib/v3/format'

type Row = {
  userId: string
  name: string
  rule: Omit<IncentiveRule, 'user_id'>
  ruleIsDefault: boolean
  breakdown: IncentiveBreakdown
  confirmed: IncentiveSettlement | null
}

type Response = {
  month: string
  sample: boolean
  rulesSample: boolean
  settlementsSample: boolean
  rows: Row[]
  totals: { videoCount: number; totalViews: number; computedAmount: number; confirmedAmount: number; confirmedCount: number }
  error?: string
}

const COLUMNS: DocColumn[] = [
  { key: 'name', label: '직원', width: '110px' },
  { key: 'videos', label: '영상 (롱 / 숏)', width: '120px', align: 'right' },
  { key: 'views', label: '조회수', width: '110px', align: 'right' },
  { key: 'rule', label: '규칙', width: 'minmax(0, 1.3fr)' },
  { key: 'amount', label: '예상 정산액', width: '130px', align: 'right' },
  { key: 'status', label: '확정', width: '150px' },
  { key: 'actions', label: '', width: '150px' }
]

export default function IncentiveSettlementsPage() {
  const { toast, showSuccess, showError } = useToast()
  const [month, setMonth] = useState(getCurrentMonth())
  const [data, setData] = useState<Response | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(
    async (target: string) => {
      const { ok, data } = await authedFetchJson<Response>(`/api/v3/incentive-settlements?month=${target}`)
      if (!ok || data?.error) {
        showError(data?.error || '정산 조회에 실패했습니다.')
        return
      }
      setData(data)
    },
    [showError]
  )

  useEffect(() => {
    void load(month)
  }, [month, load])

  const confirm = async (userIds?: string[], recompute = false) => {
    const label = userIds ? '선택한 직원' : '전체 직원'
    if (!window.confirm(`${formatMonthLabel(month)} ${label} 정산을 ${recompute ? '다시 계산해서 ' : ''}확정할까요? 확정 시점의 영상 수·조회수·금액이 스냅샷으로 저장됩니다.`)) return
    setSaving(true)
    const { ok, data: res } = await authedPostJson<{ error?: string; confirmed?: number; message?: string }>('/api/v3/incentive-settlements', {
      month,
      userIds,
      recompute
    })
    setSaving(false)
    if (!ok || res?.error) {
      showError(res?.error || '확정에 실패했습니다.')
      return
    }
    showSuccess(res?.message || `${res?.confirmed || 0}명의 정산을 확정했습니다.`)
    await load(month)
  }

  const unconfirm = async (row: Row) => {
    if (!window.confirm(`${row.name}의 ${formatMonthLabel(month)} 확정을 취소할까요?`)) return
    setSaving(true)
    const { ok, data: res } = await authedFetchJson<{ error?: string }>(`/api/v3/incentive-settlements?month=${month}&userId=${row.userId}`, { method: 'DELETE' })
    setSaving(false)
    if (!ok || res?.error) {
      showError(res?.error || '확정 취소에 실패했습니다.')
      return
    }
    showSuccess('확정을 취소했습니다.')
    await load(month)
  }

  const rows = data?.rows || []
  const unconfirmedCount = rows.filter((row) => !row.confirmed).length

  return (
    <>
      <PageHeader
        icon="🧾"
        title="직원 인센티브 정산"
        subtitle="실제 등록 영상 수와 조회수에 직원별 규칙을 적용해 월 정산액을 계산하고 확정합니다."
        actions={<MonthPicker value={month} onChange={setMonth} disabled={saving} />}
      />
      <Toast toast={toast} />
      <SampleBanner show={!!data?.sample} />

      {data ? (
        <>
          <Callout icon="🧮" tone={data.totals.confirmedCount === rows.length && rows.length > 0 ? 'success' : 'info'}>
            <strong>{formatMonthLabel(month)} 예상 정산 합계 {formatKrw(data.totals.computedAmount)}.</strong> 직원 {rows.length}명 · 영상{' '}
            {formatNumber(data.totals.videoCount)}개 · 조회수 {formatNumber(data.totals.totalViews)}회. 확정 {data.totals.confirmedCount}/{rows.length}명
            {data.totals.confirmedCount > 0 ? ` (확정액 합계 ${formatKrw(data.totals.confirmedAmount)})` : ''}.
            {data.rulesSample ? ' 규칙 테이블이 없어 기본 규칙으로 계산했습니다.' : ''}
          </Callout>

          <div className="v3-kpi-grid">
            <KpiCard label="예상 정산 합계" current={data.totals.computedAmount} />
            <KpiCard label="확정 정산 합계" current={data.totals.confirmedAmount} />
            <KpiCard label="이 달 영상" current={data.totals.videoCount} format={(v) => `${formatNumber(v)}개`} />
            <KpiCard label="이 달 조회수" current={data.totals.totalViews} format={(v) => `${formatNumber(v)}회`} />
          </div>

          <Section
            title="직원별 정산표"
            count={rows.length}
            description="영상 수와 조회수는 youtubeCRM_videos 실데이터(해당 월 등록분) 기준입니다."
            actions={
              <>
                <Link className="button secondary xs" href="/v3/incentive-rules">
                  규칙 편집
                </Link>
                <button className="button xs" onClick={() => confirm()} disabled={saving || unconfirmedCount === 0}>
                  {saving ? '처리 중…' : `미확정 ${unconfirmedCount}명 일괄 확정`}
                </button>
              </>
            }
          >
            <DocTable columns={COLUMNS} isEmpty={rows.length === 0} empty="재직 중인 직원이 없습니다.">
              {rows.map((row) => (
                <DocRow columns={COLUMNS} key={row.userId}>
                  <div className="v3-cell-main">{row.name}</div>
                  <div className="data-right">
                    {formatNumber(row.breakdown.videoCount)}
                    <span className="muted small">
                      {' '}
                      ({row.breakdown.longformCount} / {row.breakdown.shortformCount})
                    </span>
                  </div>
                  <div className="data-right">{formatNumber(row.breakdown.totalViews)}</div>
                  <div className="v3-cell-sub" title={`기본급 ${formatKrw(row.rule.base_pay)} · 영상당 ${formatKrw(row.rule.per_video)} · 1,000회당 ${formatKrw(row.rule.per_1k_views)} · 롱폼 ×${row.rule.longform_weight} · 숏폼 ×${row.rule.shortform_weight}`}>
                    {row.ruleIsDefault ? <Tag tone="gray">기본 규칙</Tag> : null} 기본 {formatKrw(row.rule.base_pay)} · 영상당 {formatKrw(row.rule.per_video)} · 1k뷰{' '}
                    {formatKrw(row.rule.per_1k_views)} · ×{row.rule.longform_weight}/{row.rule.shortform_weight}
                  </div>
                  <div className="data-right" style={{ fontWeight: 700 }}>
                    {formatKrw(row.breakdown.amount)}
                    <div className="v3-cell-sub">
                      {formatKrw(row.breakdown.basePay)} + {formatKrw(row.breakdown.videoPay)} + {formatKrw(row.breakdown.viewPay)}
                    </div>
                  </div>
                  <div>
                    {row.confirmed ? (
                      <div>
                        <Tag tone="green">확정 {formatKrw(row.confirmed.computed_amount)}</Tag>
                        <div className="v3-cell-sub">{formatDateTime(row.confirmed.confirmed_at)}</div>
                      </div>
                    ) : (
                      <Tag tone="amber">미확정</Tag>
                    )}
                  </div>
                  <div className="v3-cell-actions">
                    {row.confirmed ? (
                      <>
                        <button className="button secondary xs" onClick={() => confirm([row.userId], true)} disabled={saving}>
                          재확정
                        </button>
                        <button className="button danger xs" onClick={() => unconfirm(row)} disabled={saving}>
                          취소
                        </button>
                      </>
                    ) : (
                      <button className="button xs" onClick={() => confirm([row.userId])} disabled={saving}>
                        확정
                      </button>
                    )}
                  </div>
                </DocRow>
              ))}
              {rows.length > 0 ? (
                <DocRow columns={COLUMNS} className="v3-row-total">
                  <div>합계</div>
                  <div className="data-right">{formatNumber(data.totals.videoCount)}</div>
                  <div className="data-right">{formatNumber(data.totals.totalViews)}</div>
                  <div />
                  <div className="data-right">{formatKrw(data.totals.computedAmount)}</div>
                  <div className="small">확정 {formatKrw(data.totals.confirmedAmount)}</div>
                  <div />
                </DocRow>
              ) : null}
            </DocTable>
          </Section>

          <Callout icon="📐">
            <strong>계산 공식.</strong>
            <div className="v3-formula" style={{ marginTop: 8 }}>
              정산액 = 기본급{'\n'}
              {'       '}+ Σ영상 ( 영상당 단가 × 가중치 ){'\n'}
              {'       '}+ Σ영상 ( 조회수 ÷ 1,000 × 조회수 1,000당 단가 × 가중치 ){'\n'}
              가중치 = 롱폼 → longform_weight, 숏폼 → shortform_weight (원 단위 내림)
            </div>
            확정하면 그 시점의 영상 수 · 조회수 · 금액이 스냅샷으로 저장되어 이후 조회수가 늘어도 확정액은 바뀌지 않습니다. 재확정을 누르면 현재 값으로 덮어씁니다.
          </Callout>
        </>
      ) : (
        <div className="empty-state">정산표를 불러오는 중입니다.</div>
      )}
    </>
  )
}
