'use client'

import { Fragment, useEffect, useState } from 'react'
import { AdminOnly } from '@/components/v2/auth-guard'
import { PageHeader } from '@/components/v2/app-shell'
import { SampleBanner } from '@/components/v2/sample-banner'
import { Toast, useToast } from '@/components/toast'
import { authedFetchJson, authedPostJson } from '@/lib/session/authed-fetch'
import { authedDeleteJson } from '@/lib/v2/client'
import { addDays, formatYmdLabel, kstYmd, weekStartMonday, WEEKDAY_LABELS } from '@/lib/v2/dates'
import { V2_MISSING_TABLE_MESSAGE } from '@/lib/v2/tables'
import type { PlannerPayload } from '@/lib/v2/types'

const EMPTY: PlannerPayload = {
  weekStart: kstYmd(),
  days: [],
  staff: [],
  planned: {},
  actual: {},
  timingHint: { weekday: null, hour: null, avgViews: 0, sampleSize: 0 }
}

function PlannerBody() {
  const { toast, showSuccess, showError } = useToast()
  const [weekStart, setWeekStart] = useState(() => weekStartMonday(kstYmd()))
  const [payload, setPayload] = useState<PlannerPayload>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [openCell, setOpenCell] = useState<{ staffId: string; day: string } | null>(null)
  const [hour, setHour] = useState(19)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async (week: string) => {
    const { ok, data } = await authedFetchJson<PlannerPayload>(`/api/v2/planner?weekStart=${week}`)
    setLoaded(true)
    if (!ok) {
      showError(data?.error || '플래너 조회 실패')
      return
    }
    setPayload(data)
  }

  useEffect(() => {
    void load(weekStart)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  const guardSample = () => {
    if (payload.sample) {
      showError(V2_MISSING_TABLE_MESSAGE)
      return true
    }
    return false
  }

  const openAdd = (staffId: string, day: string) => {
    setOpenCell({ staffId, day })
    setHour(19)
    setNote('')
  }

  const addSlot = async () => {
    if (!openCell) return
    if (guardSample()) return
    setSaving(true)
    try {
      const { ok, data } = await authedPostJson<{ ok?: boolean; error?: string }>('/api/v2/planner', {
        staffUserId: openCell.staffId,
        plannedDate: openCell.day,
        plannedHour: hour,
        note: note.trim() || null
      })
      if (!ok) {
        showError(data?.error || '슬롯 등록 실패')
        return
      }
      showSuccess('슬롯을 등록했습니다.')
      setOpenCell(null)
      await load(weekStart)
    } finally {
      setSaving(false)
    }
  }

  const removeSlot = async (id: string) => {
    if (guardSample()) return
    const { ok, data } = await authedDeleteJson<{ ok?: boolean; error?: string }>(`/api/v2/planner?id=${id}`)
    if (!ok) {
      showError(data?.error || '슬롯 삭제 실패')
      return
    }
    showSuccess('삭제했습니다.')
    await load(weekStart)
  }

  const hint = payload.timingHint

  return (
    <>
      <PageHeader
        title="발행 모멘텀 플래너"
        subtitle="요일 × 담당자 업로드 계획 대비 실제 등록 수를 확인하고, 빈 슬롯을 채워주세요."
        actions={
          <div className="row" style={{ gap: 6 }}>
            <button className="button secondary xs" onClick={() => setWeekStart((w) => addDays(w, -7))}>
              ← 이전 주
            </button>
            <button className="button secondary xs" onClick={() => setWeekStart(weekStartMonday(kstYmd()))}>
              이번 주
            </button>
            <button className="button secondary xs" onClick={() => setWeekStart((w) => addDays(w, 7))}>
              다음 주 →
            </button>
          </div>
        }
      />
      <Toast toast={toast} />
      <SampleBanner show={payload.sample} />

      <div className="v2-insight">
        {hint.weekday !== null && hint.hour !== null
          ? `최근 데이터 기준, ${WEEKDAY_LABELS[hint.weekday]}요일 ${hint.hour}시에 발행한 영상의 평균 조회수가 가장 높습니다 (평균 ${hint.avgViews.toLocaleString('ko-KR')}회, 표본 ${hint.sampleSize}건). 이 시간대 위주로 슬롯을 배치해 보세요.`
          : '발행 시간대별 데이터가 충분하지 않아 최적 시간을 추천할 수 없습니다.'}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">
              {formatYmdLabel(payload.days[0] || weekStart)} ~ {formatYmdLabel(payload.days[6] || weekStart)}
            </div>
            <p className="panel-subtitle">칸을 클릭하면 해당 담당자·요일에 계획 슬롯을 추가할 수 있습니다. 숫자는 실제 등록 수입니다.</p>
          </div>
        </div>

        {payload.staff.length === 0 ? (
          <div className="empty-state">{loaded ? '활성 직원이 없습니다.' : ''}</div>
        ) : (
          <div className="v2-planner-grid">
            <div />
            {payload.days.map((day) => (
              <div className="v2-planner-head" key={day}>
                {formatYmdLabel(day)}
              </div>
            ))}
            {payload.staff.map((s) => (
              <Fragment key={s.id}>
                <div className="v2-planner-name" key={`name-${s.id}`}>
                  {s.name}
                </div>
                {payload.days.map((day) => {
                  const slots = payload.planned[s.id]?.[day] || []
                  const actualCount = payload.actual[s.id]?.[day] ?? 0
                  const plannedCount = slots.length
                  const gapClass = plannedCount === 0 ? '' : actualCount >= plannedCount ? 'gap-good' : 'gap-bad'
                  const isOpen = openCell?.staffId === s.id && openCell.day === day
                  return (
                    <div className={`v2-planner-cell ${gapClass}`} key={`${s.id}-${day}`}>
                      {slots.map((slot) => (
                        <div className="v2-planner-slot" key={slot.id} title={slot.note || ''} onClick={() => void removeSlot(slot.id)} style={{ cursor: 'pointer' }}>
                          {String(slot.planned_hour).padStart(2, '0')}:00 ✕
                        </div>
                      ))}
                      {isOpen ? (
                        <div className="stack" style={{ gap: 4 }}>
                          <select className="select compact" value={hour} onChange={(e) => setHour(Number(e.target.value))}>
                            {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                              <option key={h} value={h}>
                                {String(h).padStart(2, '0')}:00
                              </option>
                            ))}
                          </select>
                          <input className="input compact" placeholder="메모" value={note} onChange={(e) => setNote(e.target.value)} />
                          <div className="row" style={{ gap: 4 }}>
                            <button className="button success xs" disabled={saving} onClick={addSlot}>
                              추가
                            </button>
                            <button className="button secondary xs" onClick={() => setOpenCell(null)}>
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button className="button secondary xs" onClick={() => openAdd(s.id, day)}>
                          + 슬롯
                        </button>
                      )}
                      <div className="v2-planner-actual">
                        실제 {actualCount} / 계획 {plannedCount}
                      </div>
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export default function PlannerPage() {
  return (
    <AdminOnly>
      <PlannerBody />
    </AdminOnly>
  )
}
