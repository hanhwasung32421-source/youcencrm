'use client'

import { PERIOD_OPTIONS, type PeriodDays } from '@/lib/v4/analytics'
import { SAMPLE_BANNER_MESSAGE } from '@/lib/v4/tables'
import { fmtNumber } from '@/lib/v4/format'

export function PeriodToggle({ value, onChange, disabled }: { value: PeriodDays; onChange: (next: PeriodDays) => void; disabled?: boolean }) {
  return (
    <div className="v4-segment" role="group" aria-label="기간 선택">
      {PERIOD_OPTIONS.map((days) => (
        <button
          key={days}
          type="button"
          className={`v4-segment-item ${value === days ? 'active' : ''}`}
          onClick={() => onChange(days)}
          disabled={disabled}
          aria-pressed={value === days}
        >
          {days}일
        </button>
      ))}
    </div>
  )
}

export function SampleBanner({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="v4-banner" role="status">
      <span className="v4-banner-dot" />
      {SAMPLE_BANNER_MESSAGE}
    </div>
  )
}

export function KpiCard({
  title,
  value,
  meta,
  tone = 'indigo'
}: {
  title: string
  value: string
  meta?: string
  tone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate'
}) {
  return (
    <div className={`metric-card v4-kpi tone-${tone}`}>
      <div className="card-title">{title}</div>
      <div className="card-value">{value}</div>
      {meta ? <div className="card-meta">{meta}</div> : null}
    </div>
  )
}

export function TrendArrow({ trend, ratio }: { trend: 'up' | 'down' | 'flat' | 'new'; ratio: number }) {
  if (trend === 'new') return <span className="v4-trend new">NEW</span>
  const pct = `${ratio > 0 ? '+' : ''}${Math.round(ratio * 100)}%`
  if (trend === 'up') return <span className="v4-trend up">▲ {pct}</span>
  if (trend === 'down') return <span className="v4-trend down">▼ {pct}</span>
  return <span className="v4-trend flat">― {pct}</span>
}

export function FormatPill({ contentType }: { contentType: string }) {
  const short = contentType === 'shortform'
  return <span className={`v4-format ${short ? 'short' : 'long'}`}>{short ? '숏폼' : '롱폼'}</span>
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>
}

export function StatLine({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="row-between v4-statline">
      <span className="muted small">{label}</span>
      <span className="v4-num">{typeof value === 'number' ? fmtNumber(value) : value}</span>
    </div>
  )
}
