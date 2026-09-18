'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/v5/app-shell'
import { ContractStatusBadge, DealStageBadge, EmptyState, GradeChip, PartnerStatusBadge, SampleBanner, WidgetCard } from '@/components/v5/ui'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson } from '@/lib/session/authed-fetch'
import { authedDeleteJson } from '@/lib/v5/client'
import { diffDays, formatDate, formatDateTime, formatKrw, todayYmd } from '@/lib/v5/format'
import { ACTIVITY_TYPE_LABEL, PARTNER_TYPE_LABEL, type Activity, type Contract, type Deal, type Partner } from '@/lib/v5/types'

type DetailResponse = {
  sample?: boolean
  partner: Partner
  deals: Deal[]
  contracts: Contract[]
  activities: Activity[]
  error?: string
}

export default function PartnerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast, showSuccess, showError } = useToast()
  const [data, setData] = useState<DetailResponse | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const run = async () => {
      const { ok, status, data } = await authedFetchJson<DetailResponse>(`/api/v5/partners/${params.id}`)
      if (!ok || data?.error) {
        if (status === 404) setNotFound(true)
        showError(data?.error || '파트너 상세 조회 실패')
        return
      }
      setData(data)
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const today = todayYmd()
  const stats = useMemo(() => {
    if (!data) return null
    const open = data.deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost')
    return {
      openCount: open.length,
      openAmount: open.reduce((s, d) => s + (d.expected_amount || 0), 0),
      wonAmount: data.partner.won_amount || 0,
      activeContracts: data.contracts.filter((c) => c.status === 'signed' || c.status === 'executing').length
    }
  }, [data])

  const remove = async () => {
    if (!data) return
    if (!window.confirm(`"${data.partner.company_name}" 파트너와 연결된 딜 · 계약 · 활동 기록이 모두 삭제됩니다. 계속할까요?`)) return
    setDeleting(true)
    const res = await authedDeleteJson<{ ok?: boolean; error?: string }>(`/api/v5/partners/${data.partner.id}`)
    setDeleting(false)
    if (!res.ok || res.data?.error) {
      showError(res.data?.error || '삭제 실패')
      return
    }
    showSuccess('파트너를 삭제했습니다.')
    router.replace('/v5/partners')
  }

  if (notFound) {
    return (
      <>
        <PageHeader title="파트너 상세" subtitle="파트너를 찾을 수 없습니다." />
        <EmptyState>
          삭제되었거나 존재하지 않는 파트너입니다. <Link className="link" href="/v5/partners">목록으로</Link>
        </EmptyState>
      </>
    )
  }

  const p = data?.partner

  return (
    <>
      <PageHeader
        title={p ? p.company_name : '파트너 상세'}
        subtitle={p ? `${PARTNER_TYPE_LABEL[p.partner_type]} · ${p.contact_name || '담당자 미등록'}` : '불러오는 중'}
        actions={
          <>
            <Link className="button secondary sm" href="/v5/partners">
              ← 목록
            </Link>
            <Link className="button secondary sm" href={`/v5/activities?partnerId=${params.id}`}>
              활동 기록
            </Link>
            <button className="button danger sm" disabled={deleting || !data} onClick={() => void remove()}>
              {deleting ? '삭제 중…' : '삭제'}
            </button>
          </>
        }
      />
      <Toast toast={toast} />
      <SampleBanner show={Boolean(data?.sample)} />

      {p && stats ? (
        <div className="grid grid-4">
          <div className="v5-kpi">
            <div className="v5-kpi-label">등급 · 상태</div>
            <div className="row" style={{ marginTop: 10, gap: 10 }}>
              <GradeChip grade={p.grade} />
              <PartnerStatusBadge status={p.status} />
            </div>
          </div>
          <div className="v5-kpi">
            <div className="v5-kpi-label">진행 중 딜</div>
            <div className="v5-kpi-value">
              {stats.openCount}
              <small>건 · {formatKrw(stats.openAmount)}</small>
            </div>
          </div>
          <div className="v5-kpi">
            <div className="v5-kpi-label">누적 성사 계약액</div>
            <div className="v5-kpi-value" style={{ fontSize: 22 }}>
              {formatKrw(stats.wonAmount)}
            </div>
          </div>
          <div className="v5-kpi">
            <div className="v5-kpi-label">유효 계약</div>
            <div className="v5-kpi-value">
              {stats.activeContracts}
              <small>건</small>
            </div>
          </div>
        </div>
      ) : null}

      <div className="v5-detail-grid">
        <WidgetCard icon="◎" title="파트너 정보" subtitle="담당자 · 태그 · 메모" footer={p ? `등록 ${formatDate(p.created_at)} · 수정 ${formatDate(p.updated_at)}` : ''}>
          {p ? (
            <dl className="v5-kv">
              <dt>유형</dt>
              <dd>{PARTNER_TYPE_LABEL[p.partner_type]}</dd>
              <dt>담당자</dt>
              <dd>{p.contact_name || '-'}</dd>
              <dt>이메일</dt>
              <dd>{p.contact_email ? <a className="link" href={`mailto:${p.contact_email}`}>{p.contact_email}</a> : '-'}</dd>
              <dt>전화</dt>
              <dd>{p.contact_phone || '-'}</dd>
              <dt>태그</dt>
              <dd>
                <div className="row wrap" style={{ gap: 4 }}>
                  {(p.tags || []).length === 0 ? '-' : null}
                  {(p.tags || []).map((t) => (
                    <span className="v5-tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </dd>
              <dt>메모</dt>
              <dd style={{ whiteSpace: 'pre-wrap' }}>{p.memo || '-'}</dd>
            </dl>
          ) : (
            <EmptyState>불러오는 중</EmptyState>
          )}
        </WidgetCard>

        <WidgetCard icon="⇶" title="딜" subtitle="이 파트너의 협찬 딜" footer={data ? `${data.deals.length}건` : ''} footerLink={{ href: '/v5/deals', label: '파이프라인' }}>
          {data && data.deals.length === 0 ? <EmptyState>등록된 딜이 없습니다.</EmptyState> : null}
          {data && data.deals.length > 0 ? (
            <div className="v5-feed">
              {data.deals.map((d) => (
                <div className="v5-feed-item" key={d.id} style={{ gridTemplateColumns: '1fr auto' }}>
                  <div>
                    <div className="v5-feed-title">{d.campaign_name}</div>
                    <div className="v5-feed-sub">
                      {d.owner_name || '담당 미지정'} · 게시 예정 {formatDate(d.planned_publish_on)}
                      {d.next_action ? ` · 다음: ${d.next_action} (${formatDate(d.next_action_on)})` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <DealStageBadge stage={d.stage} />
                    <div className="small" style={{ fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                      {formatKrw(d.expected_amount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </WidgetCard>
      </div>

      <div className="v5-detail-grid">
        <WidgetCard icon="▤" title="계약" subtitle="기간 · 금액 · 상태" footer={data ? `${data.contracts.length}건` : ''} footerLink={{ href: '/v5/contracts', label: '계약 · 일정' }}>
          {data && data.contracts.length === 0 ? <EmptyState>등록된 계약이 없습니다.</EmptyState> : null}
          {data && data.contracts.length > 0 ? (
            <div className="v5-feed">
              {data.contracts.map((c) => {
                const remain = diffDays(today, c.ends_on)
                return (
                  <div className="v5-feed-item" key={c.id} style={{ gridTemplateColumns: '1fr auto' }}>
                    <div>
                      <div className="v5-feed-title">{c.campaign_name}</div>
                      <div className="v5-feed-sub">
                        {c.starts_on} ~ {c.ends_on} · {c.deliverables || '산출물 미기재'} · {c.ad_disclosure ? '유료광고 표시' : '광고 표시 없음'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        {c.status !== 'expired' && remain >= 0 && remain <= 30 ? <span className="v5-badge amber">만료 D-{remain}</span> : null}
                        <ContractStatusBadge status={c.status} />
                      </div>
                      <div className="small" style={{ fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                        {formatKrw(c.amount)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </WidgetCard>

        <WidgetCard icon="✎" title="활동 기록" subtitle="최근 커뮤니케이션" footer={data ? `${data.activities.length}건` : ''} footerLink={{ href: `/v5/activities?partnerId=${params.id}`, label: '전체 보기' }}>
          {data && data.activities.length === 0 ? <EmptyState>기록된 활동이 없습니다.</EmptyState> : null}
          {data && data.activities.length > 0 ? (
            <div className="v5-feed">
              {data.activities.slice(0, 8).map((a) => (
                <div className="v5-feed-item" key={a.id} style={{ gridTemplateColumns: '34px 1fr' }}>
                  <div className="v5-feed-type">{ACTIVITY_TYPE_LABEL[a.activity_type]}</div>
                  <div>
                    <div className="v5-feed-title">{a.summary}</div>
                    <div className="v5-feed-sub">
                      {formatDateTime(a.occurred_at)} · {a.author_name || '작성자 미상'}
                      {a.deal_name ? ` · ${a.deal_name}` : ''}
                      {a.next_step ? ` · 다음: ${a.next_step} (${formatDate(a.next_step_on)})` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </WidgetCard>
      </div>
    </>
  )
}
