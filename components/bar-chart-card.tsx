'use client'

type ChartItem = {
  label: string
  value: number
  displayValue?: string
}

export function BarChartCard({
  title,
  subtitle,
  items,
  tone = 'blue'
}: {
  title: string
  subtitle?: string
  items: ChartItem[]
  tone?: 'blue' | 'green' | 'violet' | 'amber'
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 0)

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">{title}</div>
          {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
        </div>
      </div>
      <div className="chart-list">
        {items.length === 0 ? (
          <div className="empty-state">표시할 통계가 없습니다.</div>
        ) : (
          items.map((item) => {
            const width = maxValue > 0 ? Math.max((item.value / maxValue) * 100, 4) : 0
            return (
              <div className="chart-row" key={item.label}>
                <div className="chart-label">{item.label}</div>
                <div className="chart-bar-track">
                  <div className={`chart-bar-fill ${tone}`} style={{ width: `${width}%` }} />
                </div>
                <div className="chart-value">{item.displayValue ?? item.value.toLocaleString('ko-KR')}</div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

