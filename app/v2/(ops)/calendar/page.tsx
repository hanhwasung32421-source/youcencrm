'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/v2/app-shell'
import { SampleBanner } from '@/components/v2/sample-banner'
import { useV2Me } from '@/components/v2/session-context'
import { ContentTypeTag, LateTag, PriorityTag, StageTag } from '@/components/v2/tags'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson } from '@/lib/session/authed-fetch'
import {
  WEEKDAY_LABELS,
  addDays,
  addMonths,
  formatKstTime,
  formatYmdLabel,
  kstDayEnd,
  kstDayStart,
  kstYmd,
  monthStart,
  weekStartMonday
} from '@/lib/v2/dates'
import { STAGES, STAGE_LABELS, isLateItem, type ItemsPayload, type ProductionItem } from '@/lib/v2/types'

type Mode = 'week' | 'month'

const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0] // 월요일 시작
const STAGE_COLORS: Record<string, string> = {
  planning: '#6b7280',
  shooting: '#3b82f6',
  editing: '#8b5cf6',
  ready: '#ffb020',
  done: '#22c55e'
}

export default function CalendarPage() {
  const me = useV2Me()
  const { toast, showError } = useToast()
  const today = kstYmd()
  const [mode, setMode] = useState<Mode>('week')
  const [anchor, setAnchor] = useState(today)
  const [selected, setSelected] = useState(today)
  const [assignee, setAssignee] = useState('')
  const [payload, setPayload] = useState<ItemsPayload>({ items: [], staff: [] })

  // 그리드에 보이는 날짜 범위
  const days = useMemo(() => {
    if (mode === 'week') {
      const start = weekStartMonday(anchor)
      return Array.from({ length: 7 }, (_, i) => addDays(start, i))
    }
    const start = weekStartMonday(monthStart(anchor))
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [mode, anchor])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const from = kstDayStart(days[0]).toISOString()
      const to = kstDayEnd(days[days.length - 1]).toISOString()
      const params = new URLSearchParams({ from, to })
      if (assignee) params.set('assignee', assignee)
      const { ok, data } = await authedFetchJson<ItemsPayload & { error?: string }>(`/api/v2/production-items?${params.toString()}`)
      if (cancelled) return
      if (!ok) {
        showError(data?.error || '캘린더 조회 실패')
        return
      }
      setPayload(data)
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, assignee])

  const now = Date.now()
  const byDay = useMemo(() => {
    const map = new Map<string, ProductionItem[]>()
    for (const item of payload.items) {
      if (!item.due_at) continue
      const key = kstYmd(new Date(item.due_at))
      const bucket = map.get(key) || []
      bucket.push(item)
      map.set(key, bucket)
    }
    for (const bucket of map.values()) bucket.sort((a, b) => (a.due_at || '').localeCompare(b.due_at || ''))
    return map
  }, [payload.items])

  const selectedItems = byDay.get(selected) || []
  const currentMonth = anchor.slice(0, 7)

  const move = (direction: -1 | 1) => {
    setAnchor((prev) => (mode === 'week' ? addDays(prev, 7 * direction) : addMonths(prev, direction)))
  }

  const rangeLabel =
    mode === 'week'
      ? `${formatYmdLabel(days[0])} ~ ${formatYmdLabel(days[6])}`
      : `${currentMonth.slice(0, 4)}년 ${Number(currentMonth.slice(5, 7))}월`

  const visibleTotal = payload.items.length
  const visibleLate = payload.items.filter((item) => isLateItem(item, now)).length

  return (
    <>
      <PageHeader
        title="콘텐츠 캘린더"
        subtitle="마감(게시 예정) 시각 기준으로 제작 아이템을 주·월 단위로 봅니다. 색은 단계를 뜻하고, 날짜를 누르면 그날 목록이 아래에 펼쳐집니다."
        actions={
          <Link className="button secondary" href="/v2/board">
            제작 보드
          </Link>
        }
      />
      <Toast toast={toast} />
      <SampleBanner show={payload.sample} />

      <div className="panel">
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <div className="v2-seg">
              <button className={mode === 'week' ? 'active' : ''} onClick={() => setMode('week')}>
                주간
              </button>
              <button className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')}>
                월간
              </button>
            </div>
            <button className="button secondary xs" onClick={() => move(-1)}>
              ◀ 이전
            </button>
            <button
              className="button secondary xs"
              onClick={() => {
                setAnchor(today)
                setSelected(today)
              }}
            >
              오늘
            </button>
            <button className="button secondary xs" onClick={() => move(1)}>
              다음 ▶
            </button>
            <span className="v2-mono small" style={{ fontWeight: 700 }}>
              {rangeLabel}
            </span>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <span className="small muted v2-mono">
              {visibleTotal}건 · 지연 {visibleLate}
            </span>
            {me.isAdmin ? (
              <select className="select compact" style={{ maxWidth: 180 }} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">전체 담당자</option>
                {payload.staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>

        <div className="v2-legend" style={{ margin: '12px 0' }}>
          {STAGES.map((stage) => (
            <span key={stage}>
              <i style={{ background: STAGE_COLORS[stage] }} />
              {STAGE_LABELS[stage]}
            </span>
          ))}
        </div>

        <div className="v2-cal-grid" style={{ marginBottom: 6 }}>
          {DOW_ORDER.map((dow) => (
            <div key={dow} className={`v2-cal-dow ${dow === 0 ? 'sun' : dow === 6 ? 'sat' : ''}`}>
              {WEEKDAY_LABELS[dow]}
            </div>
          ))}
        </div>
        <div className="v2-cal-grid">
          {days.map((day) => {
            const list = byDay.get(day) || []
            const lateCount = list.filter((item) => isLateItem(item, now)).length
            const outside = mode === 'month' && !day.startsWith(currentMonth)
            const maxChips = mode === 'week' ? 8 : 3
            return (
              <button
                type="button"
                key={day}
                className={`v2-cal-day ${mode} ${selected === day ? 'selected' : ''} ${day === today ? 'today' : ''} ${outside ? 'outside' : ''}`}
                onClick={() => setSelected(day)}
              >
                <div className="v2-cal-date">
                  <span>{mode === 'week' ? day.slice(5).replace('-', '/') : Number(day.slice(8))}</span>
                  {list.length > 0 ? <span className={`v2-cal-count ${lateCount > 0 ? 'hot' : ''}`}>{list.length}</span> : null}
                </div>
                {list.slice(0, maxChips).map((item) => (
                  <div key={item.id} className={`v2-cal-chip stage-${item.stage}`} title={`${formatKstTime(item.due_at)} ${item.stock_name} · ${item.assignee_name || ''}`}>
                    {mode === 'week' ? `${formatKstTime(item.due_at)} ` : ''}
                    {item.stock_name}
                    {mode === 'week' && item.assignee_name ? ` · ${item.assignee_name}` : ''}
                  </div>
                ))}
                {list.length > maxChips ? <div className="v2-cal-more">+{list.length - maxChips}</div> : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">{formatYmdLabel(selected)}</div>
            <p className="panel-subtitle">{selectedItems.length}건 · 마감 시각 순</p>
          </div>
        </div>
        {selectedItems.length === 0 ? (
          <div className="empty-state">이 날짜에 마감 예정인 제작 아이템이 없습니다.</div>
        ) : (
          <div className="list">
            {selectedItems.map((item) => {
              const late = isLateItem(item, now)
              return (
                <div className="list-item" key={item.id}>
                  <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="v2-card-title">
                        <span className="v2-mono muted small">{formatKstTime(item.due_at)}</span>
                        <span>{item.stock_name}</span>
                        <StageTag stage={item.stage} />
                        <ContentTypeTag contentType={item.content_type} />
                        {item.priority !== 'normal' ? <PriorityTag priority={item.priority} /> : null}
                        {late ? <LateTag /> : null}
                      </div>
                      {item.issue_summary ? (
                        <div className="v2-card-issue" style={{ marginTop: 4 }}>
                          {item.issue_summary}
                        </div>
                      ) : null}
                      <div className="v2-card-meta" style={{ marginTop: 6 }}>
                        <span>담당 {item.assignee_name || '-'}</span>
                        {item.checklist_total ? (
                          <span>
                            체크 {item.checklist_done ?? 0}/{item.checklist_total}
                          </span>
                        ) : null}
                        {item.note ? <span>메모: {item.note}</span> : null}
                      </div>
                    </div>
                    <Link className="button secondary xs" href="/v2/board">
                      보드
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
