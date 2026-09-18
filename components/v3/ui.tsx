'use client'

import { V3_SQL_FILE } from '@/lib/v3/tables'
import { formatMonthLabel, pctChange, shiftMonth } from '@/lib/v3/finance'
import { formatKrw, formatSignedPct } from '@/lib/v3/format'

// ── 샘플 데이터 배너 ────────────────────────────────────────────
export function SampleBanner({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="v3-sample-banner" role="status">
      <span aria-hidden>🧪</span>
      <span>
        샘플 데이터 표시 중 — <code>{V3_SQL_FILE}</code> 실행 후 실데이터로 전환됩니다
      </span>
    </div>
  )
}

// ── 콜아웃 ─────────────────────────────────────────────────────
export function Callout({
  icon = '💡',
  tone = 'default',
  children
}: {
  icon?: string
  tone?: 'default' | 'info' | 'warning' | 'success'
  children: React.ReactNode
}) {
  return (
    <div className={`v3-callout ${tone === 'default' ? '' : tone}`}>
      <span className="v3-callout-icon" aria-hidden>
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  )
}

// ── 문서 섹션 ──────────────────────────────────────────────────
export function Section({
  title,
  count,
  description,
  actions,
  children
}: {
  title: string
  count?: number
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="v3-section">
      <div className="v3-section-head">
        <div>
          <h2 className="v3-section-title">
            {title}
            {typeof count === 'number' ? <span className="v3-count">{count}</span> : null}
          </h2>
          {description ? <p className="v3-section-desc">{description}</p> : null}
        </div>
        {actions ? <div className="toolbar">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

// ── 태그 ───────────────────────────────────────────────────────
export function Tag({ tone = 'gray', children }: { tone?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'gray'; children: React.ReactNode }) {
  return <span className={`v3-tag ${tone}`}>{children}</span>
}

// ── 월 선택 ────────────────────────────────────────────────────
export function MonthPicker({ value, onChange, disabled }: { value: string; onChange: (month: string) => void; disabled?: boolean }) {
  return (
    <div className="v3-month-nav" aria-label="월 선택">
      <button type="button" onClick={() => onChange(shiftMonth(value, -1))} disabled={disabled} aria-label="이전 달">
        ‹
      </button>
      <input
        type="month"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          if (/^\d{4}-\d{2}$/.test(e.target.value)) onChange(e.target.value)
        }}
        aria-label={formatMonthLabel(value)}
      />
      <button type="button" onClick={() => onChange(shiftMonth(value, 1))} disabled={disabled} aria-label="다음 달">
        ›
      </button>
    </div>
  )
}

// ── KPI 카드 ───────────────────────────────────────────────────
export function KpiCard({
  label,
  current,
  previous,
  format = formatKrw,
  invert = false
}: {
  label: string
  current: number
  previous?: number
  format?: (value: number) => string
  invert?: boolean
}) {
  const change = previous === undefined ? null : pctChange(current, previous)
  const positive = change !== null && (invert ? change < 0 : change > 0)
  const negative = change !== null && (invert ? change > 0 : change < 0)
  return (
    <div className="v3-kpi">
      <div className="v3-kpi-label">{label}</div>
      <div className="v3-kpi-value" title={format(current)}>
        {format(current)}
      </div>
      {previous !== undefined ? (
        <div className={`v3-kpi-delta ${positive ? 'v3-delta-up' : negative ? 'v3-delta-down' : ''}`}>
          전월 {format(previous)} · {change === null ? '비교 불가' : formatSignedPct(change)}
        </div>
      ) : null}
    </div>
  )
}

// ── 노션 데이터베이스 풍 테이블 ───────────────────────────────
export type DocColumn = { key: string; label: string; width?: string; align?: 'left' | 'right' }

export function DocTable({
  columns,
  children,
  empty,
  isEmpty
}: {
  columns: DocColumn[]
  children: React.ReactNode
  empty?: string
  isEmpty?: boolean
}) {
  const template = columns.map((column) => column.width || 'minmax(0, 1fr)').join(' ')
  return (
    <div className="data-table">
      <div className="data-table-header" style={{ gridTemplateColumns: template }}>
        {columns.map((column) => (
          <div key={column.key} className={column.align === 'right' ? 'data-right' : undefined}>
            {column.label}
          </div>
        ))}
      </div>
      {isEmpty ? (
        <div className="data-table-row" style={{ gridTemplateColumns: '1fr' }}>
          <div className="muted small">{empty || '표시할 항목이 없습니다.'}</div>
        </div>
      ) : (
        children
      )}
    </div>
  )
}

export function DocRow({
  columns,
  className,
  children
}: {
  columns: DocColumn[]
  className?: string
  children: React.ReactNode
}) {
  const template = columns.map((column) => column.width || 'minmax(0, 1fr)').join(' ')
  return (
    <div className={`data-table-row ${className || ''}`} style={{ gridTemplateColumns: template }}>
      {children}
    </div>
  )
}
