'use client'

import { formatMonthShort } from '@/lib/v3/finance'
import { formatKrw, formatKrwCompact } from '@/lib/v3/format'

// ── 12개월 스택 막대 (인라인 SVG) ──────────────────────────────
export type StackedSeries = { key: string; label: string; color: string }
export type StackedPoint = { month: string; values: Record<string, number>; total: number }

export function StackedBarChart({ series, points, height = 220 }: { series: StackedSeries[]; points: StackedPoint[]; height?: number }) {
  const width = 720
  const padLeft = 56
  const padRight = 12
  const padTop = 18
  const padBottom = 28
  const innerW = width - padLeft - padRight
  const innerH = height - padTop - padBottom
  const max = Math.max(...points.map((p) => p.total), 1)
  const niceMax = niceCeil(max)
  const slot = innerW / Math.max(points.length, 1)
  const barW = Math.min(slot * 0.62, 40)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => r * niceMax)

  return (
    <div className="v3-chart-card">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="월별 매출 추이">
        {ticks.map((tick) => {
          const y = padTop + innerH - (tick / niceMax) * innerH
          return (
            <g key={tick}>
              <line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke="#edece9" strokeWidth={1} />
              <text x={padLeft - 8} y={y + 4} textAnchor="end" className="v3-bar-tip">
                {formatKrwCompact(tick)}
              </text>
            </g>
          )
        })}
        {points.map((point, index) => {
          const x = padLeft + slot * index + (slot - barW) / 2
          let cursor = padTop + innerH
          const isLast = index === points.length - 1
          return (
            <g key={point.month}>
              <title>{`${point.month} 총매출 ${formatKrw(point.total)}`}</title>
              {series.map((s) => {
                const value = point.values[s.key] || 0
                const h = (value / niceMax) * innerH
                cursor -= h
                return <rect key={s.key} x={x} y={cursor} width={barW} height={h} fill={s.color} opacity={isLast ? 1 : 0.85} rx={h > 3 ? 2 : 0} />
              })}
              <text x={x + barW / 2} y={height - 10} textAnchor="middle" className="v3-bar-tip" style={{ fontWeight: isLast ? 700 : 400 }}>
                {formatMonthShort(point.month)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="v3-chart-legend">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function niceCeil(value: number) {
  if (value <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(value)))
  const n = value / exp
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return nice * exp
}

// ── 도넛 (인라인 SVG) ──────────────────────────────────────────
export type DonutSlice = { key: string; label: string; value: number; color: string }

export function DonutChart({ slices, centerLabel, centerValue }: { slices: DonutSlice[]; centerLabel?: string; centerValue?: string }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const r = 60
  const stroke = 22
  const c = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="v3-chart-card">
      <div className="v3-donut-wrap">
        <svg viewBox="0 0 160 160" width={160} height={160} role="img" aria-label="매출 비중">
          <circle cx={80} cy={80} r={r} fill="none" stroke="#f1f0ed" strokeWidth={stroke} />
          {total > 0
            ? slices.map((s) => {
                const len = (s.value / total) * c
                const el = (
                  <circle
                    key={s.key}
                    cx={80}
                    cy={80}
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={stroke}
                    strokeDasharray={`${len} ${c - len}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 80 80)"
                  >
                    <title>{`${s.label} ${formatKrw(s.value)} (${((s.value / total) * 100).toFixed(1)}%)`}</title>
                  </circle>
                )
                offset += len
                return el
              })
            : null}
          <text x={80} y={76} textAnchor="middle" style={{ fontSize: 11, fill: '#787774' }}>
            {centerLabel || '총매출'}
          </text>
          <text x={80} y={94} textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: '#37352f' }}>
            {centerValue || formatKrwCompact(total)}
          </text>
        </svg>
        <div className="v3-donut-list">
          {slices.length === 0 ? <div className="muted small">표시할 수익원이 없습니다.</div> : null}
          {slices.map((s) => (
            <div key={s.key}>
              <i style={{ background: s.color }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
              <span className="muted">{total > 0 ? `${((s.value / total) * 100).toFixed(1)}%` : '—'}</span>
              <span className="data-right" style={{ fontWeight: 600 }}>
                {formatKrw(s.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 가로 막대 (순위) ───────────────────────────────────────────
export function RankBars({ items, color = '#3b6fe0' }: { items: { label: string; value: number; sub?: string }[]; color?: string }) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <div className="chart-list">
      {items.length === 0 ? <div className="empty-state">표시할 통계가 없습니다.</div> : null}
      {items.map((item, index) => (
        <div className="chart-row" key={`${item.label}-${index}`}>
          <div className="chart-label">
            <span className="v3-rank" style={{ marginRight: 6 }}>
              {index + 1}
            </span>
            {item.label}
            {item.sub ? <span className="v3-cell-sub"> {item.sub}</span> : null}
          </div>
          <div className="chart-bar-track">
            <div className="chart-bar-fill" style={{ width: `${Math.max((item.value / max) * 100, 2)}%`, background: color }} />
          </div>
          <div className="chart-value">{formatKrwCompact(item.value)}</div>
        </div>
      ))}
    </div>
  )
}
