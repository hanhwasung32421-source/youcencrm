'use client'

import { formatCompactNumber, formatNumber } from '@/lib/v3/format'

// ── 조회 성장 곡선(인라인 SVG 라인 차트) ────────────────────────
// x축: 게시 후 경과일, y축: 조회수. 스냅샷이 쌓일수록 점이 늘어난다.
export type GrowthPoint = { day: number; views: number; snapshotAt: string }

export function LineGrowthChart({ points, height = 240 }: { points: GrowthPoint[]; height?: number }) {
  const width = 680
  const padLeft = 60
  const padRight = 16
  const padTop = 18
  const padBottom = 32
  const innerW = width - padLeft - padRight
  const innerH = height - padTop - padBottom

  const maxViews = Math.max(...points.map((p) => p.views), 1)
  const maxDay = Math.max(...points.map((p) => p.day), 1)
  const xOf = (day: number) => padLeft + (maxDay > 0 ? (day / maxDay) * innerW : 0)
  const yOf = (views: number) => padTop + innerH - (views / maxViews) * innerH
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.day).toFixed(1)},${yOf(p.views).toFixed(1)}`).join(' ')
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => r * maxViews)

  return (
    <div className="v3-chart-card">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="조회수 성장 곡선">
        {ticks.map((tick) => {
          const y = yOf(tick)
          return (
            <g key={tick}>
              <line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke="#edece9" strokeWidth={1} />
              <text x={padLeft - 8} y={y + 4} textAnchor="end" className="v3-bar-tip">
                {formatCompactNumber(tick)}
              </text>
            </g>
          )
        })}
        {points.length > 1 ? <path d={path} fill="none" stroke="#3b6fe0" strokeWidth={2.5} /> : null}
        {points.map((p) => (
          <circle key={p.snapshotAt} cx={xOf(p.day)} cy={yOf(p.views)} r={4} fill="#3b6fe0">
            <title>{`게시 후 ${Math.round(p.day)}일 · 조회수 ${formatNumber(p.views)}회`}</title>
          </circle>
        ))}
        {points.map((p) => (
          <text key={`t-${p.snapshotAt}`} x={xOf(p.day)} y={height - 10} textAnchor="middle" className="v3-bar-tip">
            {Math.round(p.day)}일
          </text>
        ))}
      </svg>
    </div>
  )
}

// ── 참여율 분포 히스토그램 ───────────────────────────────────────
export function HistogramBars({ buckets }: { buckets: { label: string; count: number }[] }) {
  const max = Math.max(...buckets.map((b) => b.count), 1)
  return (
    <div className="chart-list">
      {buckets.every((b) => b.count === 0) ? (
        <div className="empty-state">표시할 통계가 없습니다.</div>
      ) : (
        buckets.map((b) => (
          <div className="chart-row" key={b.label}>
            <div className="chart-label">{b.label}</div>
            <div className="chart-bar-track">
              <div className="chart-bar-fill" style={{ width: `${b.count > 0 ? Math.max((b.count / max) * 100, 4) : 0}%` }} />
            </div>
            <div className="chart-value">{formatNumber(b.count)}개</div>
          </div>
        ))
      )}
    </div>
  )
}

// ── 좋아요 vs 댓글 참여 지형도(CSS position 기반 스캐터, 차트 라이브러리 미사용) ─
export type ScatterPoint = { id: string; label: string; x: number; y: number; sub?: string; tone?: 'blue' | 'amber' | 'violet' }

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function ScatterGrid({ points }: { points: ScatterPoint[] }) {
  return (
    <div className="v3-scatter-wrap">
      <div className="v3-scatter-box">
        <div className="v3-scatter-gridline v3-scatter-gridline-h" style={{ top: '50%' }} />
        <div className="v3-scatter-gridline v3-scatter-gridline-v" style={{ left: '50%' }} />
        {points.length === 0 ? <div className="empty-state" style={{ position: 'absolute', inset: 12 }}>표시할 영상이 없습니다.</div> : null}
        {points.map((p) => (
          <div
            key={p.id}
            className={`v3-scatter-dot ${p.tone || 'blue'}`}
            style={{ left: `${clamp(p.x, 2, 98)}%`, bottom: `${clamp(p.y, 2, 98)}%` }}
            title={`${p.label}${p.sub ? ' · ' + p.sub : ''}`}
          />
        ))}
      </div>
      <div className="v3-scatter-axis-x">좋아요 비율 →</div>
      <div className="v3-scatter-axis-y">댓글 비율 ↑</div>
    </div>
  )
}

// ── 순위 막대(형식 독립적, 값 포맷을 주입) ─────────────────────
export function RankBars({
  items,
  color = '#3b6fe0',
  format = formatNumber
}: {
  items: { label: string; value: number; sub?: string }[]
  color?: string
  format?: (value: number) => string
}) {
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
          <div className="chart-value">{format(item.value)}</div>
        </div>
      ))}
    </div>
  )
}
