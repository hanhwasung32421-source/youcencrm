'use client'

// 의존성 없는 인라인 SVG 스파크라인. 마지막 점을 강조하고 목표선(target)을 점선으로 표시한다.
export function Sparkline({
  points,
  target,
  width = 132,
  height = 34,
  color = 'var(--primary)',
  label
}: {
  points: number[]
  target?: number
  width?: number
  height?: number
  color?: string
  label?: string
}) {
  const pad = 3
  const max = Math.max(...points, target ?? 0, 1)
  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0
  const toY = (value: number) => height - pad - (value / max) * (height - pad * 2)
  const coords = points.map((value, i) => [pad + i * stepX, toY(value)] as const)
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const last = coords[coords.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label || '최근 추이'}>
      {typeof target === 'number' ? (
        <line
          x1={pad}
          x2={width - pad}
          y1={toY(target)}
          y2={toY(target)}
          stroke="var(--line-strong)"
          strokeDasharray="3 3"
          strokeWidth={1}
        />
      ) : null}
      {coords.length > 1 ? <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" /> : null}
      {last ? <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} /> : null}
    </svg>
  )
}
