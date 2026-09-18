'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/v5/app-shell'
import { SampleBanner, WidgetCard, EmptyState } from '@/components/v5/ui'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson } from '@/lib/session/authed-fetch'
import { diffDays, formatDateTime, formatKrw, formatKrwCompact, formatShortDate, todayYmd } from '@/lib/v5/format'
import { ACTIVITY_TYPE_LABEL, DEAL_STAGE_LABEL, type DashboardData, type UpcomingEvent } from '@/lib/v5/types'

const GRADE_COLORS: Record<'A' | 'B' | 'C', string> = { A: '#4f46e5', B: '#818cf8', C: '#c7d2fe' }
const EVENT_TONE: Record<UpcomingEvent['kind'], string> = {
  contract_end: 'red',
  publish: 'indigo',
  next_action: 'amber',
  next_step: 'neutral'
}

export default function PartnerDashboardPage() {
  const { toast, showError } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    setRefreshing(true)
    const { ok, data } = await authedFetchJson<DashboardData & { error?: string }>('/api/v5/dashboard')
    setRefreshing(false)
    if (!ok || data?.error) {
      showError(data?.error || '대시보드 조회 실패')
      return
    }
    setData(data)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const today = todayYmd()
  const funnelMax = useMemo(() => Math.max(1, ...(data?.funnel.map((f) => f.count) || [1])), [data])
  const pipelineAmount = useMemo(
    () => (data?.funnel || []).filter((f) => f.stage !== 'won').reduce((s, f) => s + f.amount, 0),
    [data]
  )
  const gradeTotal = useMemo(() => (data?.gradeDistribution || []).reduce((s, g) => s + g.count, 0), [data])

  const kpis = data?.kpis

  return (
    <>
      <PageHeader
        title="파트너 대시보드"
        subtitle="광고주 · 증권사 파트너, 협찬 딜 파이프라인, 계약 만료와 컴플라이언스 현황을 위젯으로 봅니다."
        actions={
          <button className="button secondary sm" disabled={refreshing} onClick={() => void load()}>
            {refreshing ? '새로고침 중…' : '새로고침'}
          </button>
        }
      />
      <Toast toast={toast} />
      <SampleBanner show={Boolean(data?.sample)} />

      <div className="v5-kpi-grid">
        <div className="v5-kpi">
          <div className="v5-kpi-label">활성 파트너</div>
          <div className="v5-kpi-value">
            {kpis ? kpis.activePartners : '–'}
            <small>사</small>
          </div>
          <div className="v5-kpi-meta">휴면·종료 제외</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-label">진행 중 딜</div>
          <div className="v5-kpi-value">
            {kpis ? kpis.openDeals : '–'}
            <small>건</small>
          </div>
          <div className="v5-kpi-meta">리드 ~ 집행 중</div>
        </div>
        <div className="v5-kpi">
          <div className="v5-kpi-label">이번 달 예상 계약액</div>
          <div className="v5-kpi-value" title={kpis ? formatKrw(kpis.monthExpectedAmount) : ''}>
            {kpis ? formatKrwCompact(kpis.monthExpectedAmount) : '–'}
            <small>원</small>
          </div>
          <div className="v5-kpi-meta">이번 달 게시 예정 딜 + 시작 계약</div>
        </div>
        <div className={`v5-kpi ${kpis && kpis.expiringContracts30d > 0 ? 'tone-amber' : ''}`}>
          <div className="v5-kpi-label">30일 내 만료 계약</div>
          <div className="v5-kpi-value">
            {kpis ? kpis.expiringContracts30d : '–'}
            <small>건</small>
          </div>
          <div className="v5-kpi-meta">연장 협의 필요</div>
        </div>
        <div className={`v5-kpi ${kpis && kpis.complianceIncomplete > 0 ? 'tone-red' : 'tone-green'}`}>
          <div className="v5-kpi-label">컴플라이언스 미완료 영상</div>
          <div className="v5-kpi-value">
            {kpis ? kpis.complianceIncomplete : '–'}
            <small>편</small>
          </div>
          <div className="v5-kpi-meta">통과 처리되지 않은 영상</div>
        </div>
      </div>

      <div className="grid grid-3">
        <WidgetCard
          icon="⇶"
          title="딜 파이프라인"
          subtitle="단계별 건수 · 예상 금액"
          className="span-2"
          footer={data ? `파이프라인 합계 ${formatKrw(pipelineAmount)} · 실패 ${data.lostCount}건` : ''}
          footerLink={{ href: '/v5/deals', label: '파이프라인 열기' }}
        >
          {data ? (
            <div className="v5-funnel">
              {data.funnel.map((row) => (
                <div className="v5-funnel-row" key={row.stage}>
                  <div className="v5-funnel-stage">{DEAL_STAGE_LABEL[row.stage]}</div>
                  <div className="v5-funnel-track">
                    <div
                      className={`v5-funnel-bar ${row.stage === 'won' ? 'won' : ''}`}
                      style={{ width: `${Math.max((row.count / funnelMax) * 100, row.count > 0 ? 8 : 0)}%` }}
                    >
                      {row.count > 0 ? `${row.count}건` : ''}
                    </div>
                  </div>
                  <div className="v5-funnel-amount">{formatKrw(row.amount)}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>불러오는 중</EmptyState>
          )}
        </WidgetCard>

        <WidgetCard
          icon="◐"
          title="파트너 등급 분포"
          subtitle="종료 파트너 제외"
          footer={`총 ${gradeTotal}사`}
          footerLink={{ href: '/v5/partners', label: '파트너 보기' }}
        >
          {data ? <GradeDonut items={data.gradeDistribution} total={gradeTotal} /> : <EmptyState>불러오는 중</EmptyState>}
        </WidgetCard>
      </div>

      <div className="grid grid-2">
        <WidgetCard
          icon="▦"
          title="다가오는 일정"
          subtitle="14일 내 계약 만료 · 집행 예정 · 다음 액션"
          footer={data ? `${data.upcoming.length}건` : ''}
          footerLink={{ href: '/v5/contracts', label: '계약 · 일정' }}
        >
          {data && data.upcoming.length === 0 ? <EmptyState>14일 내 예정된 일정이 없습니다.</EmptyState> : null}
          {data && data.upcoming.length > 0 ? (
            <div className="v5-feed">
              {data.upcoming.map((ev, idx) => {
                const dday = diffDays(today, ev.date)
                return (
                  <Link className="v5-feed-item" href={ev.href} key={`${ev.kind}-${idx}`}>
                    <div className="v5-feed-date">
                      {formatShortDate(ev.date)}
                      <small>{dday === 0 ? '오늘' : `D-${dday}`}</small>
                    </div>
                    <div>
                      <div className="row" style={{ gap: 8 }}>
                        <span className={`v5-badge ${EVENT_TONE[ev.kind]}`}>{ev.label}</span>
                        <span className="v5-feed-title">{ev.title}</span>
                      </div>
                      <div className="v5-feed-sub">{ev.subtitle}</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : null}
        </WidgetCard>

        <WidgetCard
          icon="✎"
          title="최근 활동"
          subtitle="커뮤니케이션 로그 최신 8건"
          footer={data ? `${data.recentActivities.length}건 표시` : ''}
          footerLink={{ href: '/v5/activities', label: '전체 로그' }}
        >
          {data && data.recentActivities.length === 0 ? <EmptyState>기록된 활동이 없습니다.</EmptyState> : null}
          {data && data.recentActivities.length > 0 ? (
            <div className="v5-feed">
              {data.recentActivities.map((a) => (
                <div className="v5-feed-item" key={a.id} style={{ gridTemplateColumns: '34px 1fr' }}>
                  <div className="v5-feed-type">{ACTIVITY_TYPE_LABEL[a.activity_type]}</div>
                  <div>
                    <div className="v5-feed-title">{a.summary}</div>
                    <div className="v5-feed-sub">
                      {[a.partner_name, a.deal_name].filter(Boolean).join(' · ')} · {a.author_name || '작성자 미상'} · {formatDateTime(a.occurred_at)}
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

// 인라인 SVG 도넛. 외부 차트 라이브러리 없이 stroke-dasharray 로 그린다.
function GradeDonut({ items, total }: { items: Array<{ grade: 'A' | 'B' | 'C'; count: number }>; total: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  let offset = 0
  const segments = items.map((item) => {
    const fraction = total > 0 ? item.count / total : 0
    const seg = { ...item, fraction, dash: fraction * circumference, offset }
    offset += fraction * circumference
    return seg
  })

  return (
    <div className="v5-donut-wrap">
      <svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label="파트너 등급 분포">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#eef0f7" strokeWidth="18" />
        {segments.map((seg) => (
          <circle
            key={seg.grade}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={GRADE_COLORS[seg.grade]}
            strokeWidth="18"
            strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
            strokeDashoffset={-seg.offset}
            transform="rotate(-90 70 70)"
          />
        ))}
        <text x="70" y="66" textAnchor="middle" fontSize="22" fontWeight="800" fill="#14161f">
          {total}
        </text>
        <text x="70" y="84" textAnchor="middle" fontSize="11" fill="#6b7280">
          파트너
        </text>
      </svg>
      <div className="v5-legend">
        {segments.map((seg) => (
          <div className="v5-legend-row" key={seg.grade}>
            <span className="v5-legend-dot" style={{ background: GRADE_COLORS[seg.grade] }} />
            <span style={{ fontWeight: 700 }}>{seg.grade}등급</span>
            <span className="muted" style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
              {seg.count}사 · {Math.round(seg.fraction * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
